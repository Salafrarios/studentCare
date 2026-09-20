"""Serviço em background que lê uma câmera local ou um arquivo .mp4, extrai o
esqueleto (nunca o vídeo) e roda o modelo GRU numa janela deslizante de 179
frames (~9s a 20fps). Não grava vídeo nem frames em disco."""
from __future__ import annotations

import threading
import time
from collections import deque
from typing import Any, Dict, Optional

import cv2
import numpy as np

from .deteccao import (
    GATILHO_AUTOMATICO_ATIVO,
    ExtratorPose,
    ModeloAcoes,
    avaliar_gatilho_automatico,
)

TAMANHO_JANELA = 179
FPS_ALVO = 20


class ServicoCaptura:
    def __init__(self, caminho_checkpoint: str, caminho_pose_task: str) -> None:
        self._caminho_checkpoint = caminho_checkpoint
        self._caminho_pose_task = caminho_pose_task
        self._modelo: Optional[ModeloAcoes] = None
        self._lock = threading.Lock()
        self._thread: Optional[threading.Thread] = None
        self._parar = threading.Event()
        self._estado: Dict[str, Any] = {
            "rodando": False,
            "sala_id": None,
            "fonte": None,
            "buffer_frames": 0,
            "acao_prevista": None,
            "confianca": None,
            "esqueleto": None,
            "gatilho_automatico_ativo": GATILHO_AUTOMATICO_ATIVO,
            "erro": None,
        }

    def status(self) -> Dict[str, Any]:
        with self._lock:
            return dict(self._estado)

    def iniciar(self, sala_id: str, fonte: str, indice_camera: int = 0, caminho_arquivo: Optional[str] = None) -> None:
        with self._lock:
            if self._estado["rodando"]:
                raise RuntimeError("Já existe uma captura em andamento. Pare antes de iniciar outra.")
            self._parar.clear()
            self._estado.update(
                rodando=True, sala_id=sala_id, fonte=fonte, buffer_frames=0,
                acao_prevista=None, confianca=None, esqueleto=None, erro=None,
            )
        self._thread = threading.Thread(target=self._loop, args=(fonte, indice_camera, caminho_arquivo), daemon=True)
        self._thread.start()

    def parar(self) -> None:
        self._parar.set()
        if self._thread is not None:
            self._thread.join(timeout=5)
        with self._lock:
            self._estado["rodando"] = False

    def _loop(self, fonte: str, indice_camera: int, caminho_arquivo: Optional[str]) -> None:
        try:
            if self._modelo is None:
                self._modelo = ModeloAcoes(self._caminho_checkpoint)
            extrator = ExtratorPose(self._caminho_pose_task)

            origem = indice_camera if fonte == "webcam" else caminho_arquivo
            captura = cv2.VideoCapture(origem)
            if not captura.isOpened():
                raise RuntimeError(f"Não foi possível abrir a fonte de vídeo: {origem!r}")

            fps_origem = captura.get(cv2.CAP_PROP_FPS) or FPS_ALVO
            # ponytail: reamostragem por vizinho mais próximo (passo fixo), não
            # interpolação — suficiente para ~20fps alvo; trocar se precisar de
            # exatidão temporal maior.
            passo = max(1, round(fps_origem / FPS_ALVO)) if fonte == "arquivo" else 1
            intervalo_minimo = 1.0 / FPS_ALVO
            ultimo_ts = 0.0
            buffer: deque[np.ndarray] = deque(maxlen=TAMANHO_JANELA)
            indice_frame = 0

            while not self._parar.is_set():
                ok, frame = captura.read()
                if not ok:
                    break  # fim do arquivo ou falha ao ler da câmera

                if fonte == "arquivo":
                    indice_frame += 1
                    if indice_frame % passo != 0:
                        continue
                else:
                    agora = time.monotonic()
                    if agora - ultimo_ts < intervalo_minimo:
                        continue
                    ultimo_ts = agora

                pontos, esqueleto_2d = extrator.processar(frame)
                if pontos is not None:
                    buffer.append(pontos)

                atualizacao: Dict[str, Any] = {"buffer_frames": len(buffer), "esqueleto": esqueleto_2d}
                if len(buffer) == TAMANHO_JANELA:
                    resultado = self._modelo.prever(np.stack(buffer))
                    atualizacao["acao_prevista"] = resultado["acao"]
                    atualizacao["confianca"] = resultado["confianca"]
                    if GATILHO_AUTOMATICO_ATIVO and avaliar_gatilho_automatico(buffer):
                        atualizacao["gatilho_disparado_em"] = time.time()  # placeholder nunca dispara

                with self._lock:
                    self._estado.update(atualizacao)

            captura.release()
        except Exception as exc:  # noqa: BLE001 - reportado no status, não deve derrubar a thread
            with self._lock:
                self._estado["erro"] = str(exc)
        finally:
            with self._lock:
                self._estado["rodando"] = False
