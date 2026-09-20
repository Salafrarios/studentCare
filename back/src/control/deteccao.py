"""Inferência de ações a partir de esqueleto (MediaPipe Pose -> GRU treinado no MMASD+).

AVISO IMPORTANTE (não remova este contexto ao editar o arquivo):
O modelo classifica 11 AÇÕES DE TERAPIA (Arm_Swing, Body_pose, chest_expansion,
Frog_Pose, Drumming, Marcas_Forward, Marcas_Shaking, Sing_Clap, Squat_Pose,
Tree_Pose, Twist_Pose), treinado em crianças em terapia (MMASD+, 32 crianças).
Ele NÃO detecta crise, agitação ou emoção, e tem ~70% de acurácia em crianças
não vistas (ver metricas.json). Não é diagnóstico.
"""
from __future__ import annotations

import os
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np
import torch
import torch.nn as nn
from mediapipe import Image, ImageFormat
from mediapipe.tasks.python import BaseOptions, vision

# ==========================================================================
# Mapeamento MediaPipe Pose (33 pontos) -> pontos do modelo (25 pontos)
# ==========================================================================
# O modelo foi treinado com 25 pontos, nesta ordem exata:
ORDEM_MODELO: List[str] = [
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_pinky", "right_pinky",
    "left_index", "right_index", "left_hip", "right_hip",
    "left_knee", "right_knee", "left_ankle", "right_ankle",
    "left_heel", "right_heel", "left_foot", "right_foot",
]

# Índice do PoseLandmark (enum de 33 pontos do MediaPipe Pose) equivalente a
# cada posição de ORDEM_MODELO. Todos os 25 pontos têm equivalente exato no
# MediaPipe (left_eye/right_eye usam o ponto central do olho, não inner/outer;
# left_foot/right_foot usam FOOT_INDEX, que é o nome do MediaPipe para a ponta
# do pé, correspondente ao "foot" do MMASD+) — nenhum ponto precisou de
# aproximação ou invenção.
MAPA_MEDIAPIPE: List[int] = [
    0,      # nose
    2, 5,   # left_eye, right_eye
    7, 8,   # left_ear, right_ear
    11, 12,  # left_shoulder, right_shoulder
    13, 14,  # left_elbow, right_elbow
    15, 16,  # left_wrist, right_wrist
    17, 18,  # left_pinky, right_pinky
    19, 20,  # left_index, right_index
    23, 24,  # left_hip, right_hip
    25, 26,  # left_knee, right_knee
    27, 28,  # left_ankle, right_ankle
    29, 30,  # left_heel, right_heel
    31, 32,  # left_foot (FOOT_INDEX), right_foot (FOOT_INDEX)
]
assert len(MAPA_MEDIAPIPE) == len(ORDEM_MODELO) == 25


class ExtratorPose:
    """Extrai os 25 pontos (x, y, z) do modelo a partir de um frame BGR (OpenCV)."""

    def __init__(self, caminho_task: str) -> None:
        opcoes = vision.PoseLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=caminho_task),
            running_mode=vision.RunningMode.IMAGE,
            num_poses=1,
        )
        self._landmarker = vision.PoseLandmarker.create_from_options(opcoes)

    def processar(self, frame_bgr: np.ndarray) -> Tuple[Optional[np.ndarray], Optional[List[List[float]]]]:
        """Retorna (pontos_75 para o modelo, esqueleto_2d para exibição) ou (None, None)."""
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        imagem = Image(image_format=ImageFormat.SRGB, data=rgb)
        resultado = self._landmarker.detect(imagem)
        if not resultado.pose_landmarks:
            return None, None
        pessoa = resultado.pose_landmarks[0]
        pontos = np.array([[pessoa[i].x, pessoa[i].y, pessoa[i].z] for i in MAPA_MEDIAPIPE], dtype=np.float32)
        esqueleto_2d = [[float(pessoa[i].x), float(pessoa[i].y)] for i in MAPA_MEDIAPIPE]
        return pontos.reshape(75), esqueleto_2d


def preparar(d: np.ndarray) -> np.ndarray:
    """Normalização idêntica à do treino (treino_gru2.py/exportar.py): centro no
    quadril, escala pelo comprimento ombro-quadril, velocidade por diff."""
    p = d.reshape(179, 25, 3)
    quadril = (p[:, 15] + p[:, 16]) / 2
    ombro = (p[:, 5] + p[:, 6]) / 2
    escala = np.linalg.norm(ombro - quadril, axis=1).mean() + 1e-6
    p = (p - quadril[:, None, :]) / escala
    d = p.reshape(179, 75)
    v = np.diff(d, axis=0, prepend=d[:1])
    return np.concatenate([d, v], 1).astype("float32")


class _GRU(nn.Module):
    """Mesma arquitetura usada no treino: GRU 2 camadas, hidden 128, -> 11 classes."""

    def __init__(self) -> None:
        super().__init__()
        self.g = nn.GRU(150, 128, 2, batch_first=True, dropout=0.3)
        self.f = nn.Linear(128, 11)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.f(self.g(x)[0][:, -1])


class ModeloAcoes:
    """Carrega o checkpoint (pesos, mu, sd, dict de ações) e roda inferência na CPU."""

    def __init__(self, caminho_checkpoint: str) -> None:
        checkpoint = torch.load(caminho_checkpoint, map_location="cpu", weights_only=False)
        self.mu = checkpoint["mu"]
        self.sd = checkpoint["sd"]
        self.acoes: Dict[int, str] = {indice: nome for nome, indice in checkpoint["acoes"].items()}
        self.modelo = _GRU()
        self.modelo.load_state_dict(checkpoint["pesos"])
        self.modelo.eval()

    @torch.no_grad()
    def prever(self, janela_179x75: np.ndarray) -> Dict[str, object]:
        x = preparar(janela_179x75)
        x = (x - self.mu) / self.sd
        tensor = torch.tensor(x, dtype=torch.float32).unsqueeze(0)
        logits = self.modelo(tensor)[0]
        probs = torch.softmax(logits, dim=0).numpy()
        indice = int(probs.argmax())
        return {
            "acao": self.acoes[indice],
            "confianca": float(probs[indice]),
            "probabilidades": {self.acoes[i]: float(p) for i, p in enumerate(probs)},
        }


# ==========================================================================
# Gatilho automático — DESLIGADO por padrão.
# ==========================================================================
GATILHO_AUTOMATICO_ATIVO = os.getenv("GATILHO_AUTOMATICO_ATIVO", "false").strip().lower() == "true"


def avaliar_gatilho_automatico(historico_predicoes) -> bool:
    """Placeholder proposital: NUNCA dispara.

    O modelo classifica 11 posturas de terapia do MMASD+, não agitação/crise.
    Não implemente aqui uma heurística usando essas 11 classes — não foi
    validada para esse fim e, num contexto de saúde, um falso positivo ou
    negativo tem custo real. Substitua este corpo por uma lógica real
    (outro sinal/modelo, validado) antes de ativar GATILHO_AUTOMATICO_ATIVO=true.
    O mecanismo principal de alerta continua sendo o botão manual do professor.
    """
    return False
