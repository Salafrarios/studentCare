"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useAuth } from "@/control/AuthContext";
import { apiService, Sala, FonteDeteccao, StatusDeteccao, IniciarDeteccaoRequest } from "@/model/api";
import { useNotifications } from "@/control/useNotifications";

const FONTES: { value: FonteDeteccao; label: string }[] = [
  { value: "webcam", label: "Webcam" },
  { value: "arquivo", label: "Vídeo de teste (.mp4)" },
  { value: "camera_ip", label: "Câmera IP da sala" },
];

const SALAS = [
  { value: "", label: "Selecione uma sala" },
  { value: "sala-101", label: "Sala 101" },
  { value: "sala-102", label: "Sala 102" },
  { value: "sala-103", label: "Sala 103" },
  { value: "sala-201", label: "Sala 201" },
  { value: "sala-202", label: "Sala 202" },
  { value: "lab-info-1", label: "Lab. Informática 1" },
  { value: "lab-info-2", label: "Lab. Informática 2" },
  { value: "auditorio", label: "Auditório" },
];

const TIPOS_CRISE = [
  { value: "", label: "Selecione o tipo" },
  { value: "Crise de Ansiedade", label: "Crise de Ansiedade" },
  { value: "Meltdown", label: "Meltdown" },
  { value: "Crise de Pânico", label: "Crise de Pânico" },
  { value: "Outro", label: "Outro" },
];

export default function ProfessorDashboard() {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const [salas, setSalas] = useState<{ value: string; label: string }[]>(SALAS);
  const [salasCompletas, setSalasCompletas] = useState<Sala[]>([]);
  const [salaId, setSalaId] = useState("");
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [tipoCrise, setTipoCrise] = useState("");
  const [descricao, setDescricao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Detecção de ações
  const [fonteDeteccao, setFonteDeteccao] = useState<FonteDeteccao>("webcam");
  const [indiceCamera, setIndiceCamera] = useState(0);
  const [caminhoArquivo, setCaminhoArquivo] = useState("");
  const [statusDeteccao, setStatusDeteccao] = useState<StatusDeteccao | null>(null);
  const [deteccaoLoading, setDeteccaoLoading] = useState(false);
  const [deteccaoErro, setDeteccaoErro] = useState<string | null>(null);
  const canvasEsqueletoRef = useRef<HTMLCanvasElement>(null);

  const salaSelecionada = salasCompletas.find((s) => s.id === salaId) || null;

  // Carrega salas cadastradas da API (cadastradas pelo admin de TI) e
  // atualiza a cada 10s, sem precisar recarregar a página.
  useEffect(() => {
    const carregarSalas = async () => {
      try {
        const dados = await apiService.getSalas();
        if (dados && dados.length > 0) {
          setSalasCompletas(dados);
          const formatadas = [
            { value: "", label: "Selecione uma sala" },
            ...dados.map((s) => ({
              value: s.id,
              label: s.bloco ? `${s.nome} (${s.bloco})` : s.nome,
            })),
          ];
          setSalas(formatadas);
        }
      } catch {
        // Mantém fallback estático
      }
    };
    carregarSalas();
    const intervalId = setInterval(carregarSalas, 10000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!salaId) {
      setStreamUrl(null);
      return;
    }
    const carregarCamera = async () => {
      setCameraLoading(true);
      try {
        const data = await apiService.getCameraStream(salaId);
        setStreamUrl(data.stream_url);
      } catch {
        setStreamUrl(null);
      } finally {
        setCameraLoading(false);
      }
    };
    carregarCamera();
  }, [salaId]);

  // Polling do status de detecção enquanto uma sala estiver selecionada
  useEffect(() => {
    if (!salaId) {
      setStatusDeteccao(null);
      return;
    }

    let ativo = true;
    const consultarStatus = async () => {
      try {
        const s = await apiService.getStatusDeteccao(salaId);
        if (ativo) setStatusDeteccao(s);
      } catch {
        if (ativo) setStatusDeteccao(null);
      }
    };

    consultarStatus();
    const intervalId = setInterval(consultarStatus, 1500);

    return () => {
      ativo = false;
      clearInterval(intervalId);
    };
  }, [salaId, fonteDeteccao]);

  // Desenha o esqueleto (25 pontos normalizados) no canvas sobreposto à câmera
  useEffect(() => {
    const canvas = canvasEsqueletoRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!statusDeteccao?.rodando || !statusDeteccao.esqueleto) return;
    ctx.fillStyle = "#34d399";
    for (const [x, y] of statusDeteccao.esqueleto) {
      ctx.beginPath();
      ctx.arc(x * canvas.width, y * canvas.height, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [statusDeteccao]);

  const handleIniciarDeteccao = async () => {
    if (!salaId) return;
    setDeteccaoLoading(true);
    setDeteccaoErro(null);
    try {
      const dados: IniciarDeteccaoRequest = { sala_id: salaId, fonte: fonteDeteccao };
      if (fonteDeteccao === "webcam") dados.indice_camera = indiceCamera;
      if (fonteDeteccao === "arquivo") dados.caminho_arquivo = caminhoArquivo;
      await apiService.iniciarDeteccao(dados);
      setStatusDeteccao(await apiService.getStatusDeteccao(salaId));
    } catch (err) {
      setDeteccaoErro(err instanceof Error ? err.message : "Erro ao iniciar detecção.");
    } finally {
      setDeteccaoLoading(false);
    }
  };

  const handlePararDeteccao = async () => {
    setDeteccaoLoading(true);
    setDeteccaoErro(null);
    try {
      await apiService.pararDeteccao(salaId || undefined);
      if (salaId) setStatusDeteccao(await apiService.getStatusDeteccao(salaId));
    } catch (err) {
      setDeteccaoErro(err instanceof Error ? err.message : "Erro ao parar detecção.");
    } finally {
      setDeteccaoLoading(false);
    }
  };

  const handleChamarAuxilio = async (e: FormEvent) => {
    e.preventDefault();
    if (!salaId) return;
    setEnviando(true);
    setFeedback(null);
    try {
      await apiService.chamarAuxilio({ sala: salaId, tipo: tipoCrise, descricao });
      setFeedback({ type: "success", msg: "Chamado de auxílio enviado com sucesso!" });
      setShowModal(false);
      setTipoCrise("");
      setDescricao("");
    } catch (err) {
      setFeedback({
        type: "error",
        msg: err instanceof Error ? err.message : "Erro ao enviar chamado.",
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Painel do Professor</h2>
          <p className="text-gray-500 mt-1">Olá, {user?.nome}</p>
        </div>
        {unreadCount > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2 rounded-full text-sm font-medium">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6z" />
              <path d="M10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
            </svg>
            {unreadCount} notificação(ões)
          </div>
        )}
      </div>

      {/* Seletor de sala */}
      <div>
        <label htmlFor="sala" className="block text-sm font-semibold text-gray-700 mb-1.5">
          Sala
        </label>
        <select
          id="sala"
          value={salaId}
          onChange={(e) => setSalaId(e.target.value)}
          className="w-full sm:w-72 px-4 py-3 rounded-lg border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-sm bg-white"
        >
          {salas.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Fonte da detecção */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="fonte-deteccao" className="block text-sm font-semibold text-gray-700 mb-1.5">
            Fonte da detecção
          </label>
          <select
            id="fonte-deteccao"
            value={fonteDeteccao}
            onChange={(e) => setFonteDeteccao(e.target.value as FonteDeteccao)}
            className="w-full sm:w-64 px-4 py-3 rounded-lg border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-sm bg-white"
          >
            {FONTES.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>

        {fonteDeteccao === "webcam" && (
          <div>
            <label htmlFor="indice-camera" className="block text-sm font-semibold text-gray-700 mb-1.5">
              Índice da câmera
            </label>
            <input
              id="indice-camera"
              type="number"
              min={0}
              value={indiceCamera}
              onChange={(e) => setIndiceCamera(Math.max(0, Number(e.target.value)))}
              className="w-24 px-4 py-3 rounded-lg border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              Se a câmera errada aparecer (ou nada aparecer), tente outro número (0, 1, 2...).
            </p>
          </div>
        )}

        {fonteDeteccao === "arquivo" && (
          <div className="flex-1 min-w-[240px]">
            <label htmlFor="caminho-arquivo" className="block text-sm font-semibold text-gray-700 mb-1.5">
              Caminho do arquivo .mp4 no servidor
            </label>
            <input
              id="caminho-arquivo"
              type="text"
              value={caminhoArquivo}
              onChange={(e) => setCaminhoArquivo(e.target.value)}
              placeholder="/caminho/absoluto/no/servidor/video.mp4"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-sm font-mono"
            />
          </div>
        )}

        {fonteDeteccao === "camera_ip" && (
          <div className="flex-1 min-w-[240px]">
            <span className="block text-sm font-semibold text-gray-700 mb-1.5">URL da câmera IP da sala</span>
            {salaSelecionada?.camera_url ? (
              <p className="px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 text-sm font-mono text-gray-600 truncate">
                {salaSelecionada.camera_url}
                <span className="block text-xs font-sans text-gray-400 mt-1">Configurada em Admin &gt; Salas</span>
              </p>
            ) : (
              <p className="px-4 py-3 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-700">
                {salaId
                  ? "Esta sala não possui câmera IP cadastrada. Configure em Admin > Salas."
                  : "Selecione uma sala para ver a câmera IP cadastrada."}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Câmera */}
      <div className="bg-black rounded-2xl overflow-hidden aspect-video relative">
        <canvas
          ref={canvasEsqueletoRef}
          width={320}
          height={180}
          className="absolute inset-0 w-full h-full z-10 pointer-events-none"
        />
        {!salaId ? (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p>Selecione uma sala para visualizar a câmera</p>
            </div>
          </div>
        ) : cameraLoading ? (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <svg className="animate-spin w-10 h-10 mx-auto mb-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p>Conectando à câmera...</p>
            </div>
          </div>
        ) : streamUrl ? (
          <video
            src={streamUrl}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <p>Câmera indisponível para esta sala</p>
            </div>
          </div>
        )}
      </div>

      {/* Controles e status da detecção de ações */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleIniciarDeteccao}
            disabled={
              !salaId ||
              deteccaoLoading ||
              !!statusDeteccao?.rodando ||
              (fonteDeteccao === "arquivo" && !caminhoArquivo.trim()) ||
              (fonteDeteccao === "camera_ip" && !salaSelecionada?.camera_url)
            }
            className="bg-emerald-700 hover:bg-emerald-600 disabled:bg-gray-300 text-white font-semibold py-2.5 px-5 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed text-sm"
          >
            Iniciar detecção
          </button>
          <button
            onClick={handlePararDeteccao}
            disabled={!salaId || deteccaoLoading || !statusDeteccao?.rodando}
            className="bg-gray-100 hover:bg-gray-200 disabled:text-gray-400 text-gray-700 font-semibold py-2.5 px-5 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed text-sm"
          >
            Parar detecção
          </button>
          <span className="text-sm text-gray-500">
            {statusDeteccao?.rodando ? `Rodando (fonte: ${statusDeteccao.fonte})` : "Detecção parada"}
          </span>
        </div>

        {deteccaoErro && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{deteccaoErro}</p>
        )}
        {statusDeteccao?.erro && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{statusDeteccao.erro}</p>
        )}

        {statusDeteccao?.rodando && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500 text-xs uppercase font-semibold mb-1">Ação prevista</p>
              <p className="font-medium text-gray-900">{statusDeteccao.acao_prevista || "—"}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase font-semibold mb-1">Confiança</p>
              <p className="font-medium text-gray-900">
                {statusDeteccao.confianca != null ? `${Math.round(statusDeteccao.confianca * 100)}%` : "—"}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase font-semibold mb-1">
                Buffer ({statusDeteccao.buffer_frames}/179)
              </p>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min(100, (statusDeteccao.buffer_frames / 179) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Botão de auxílio */}
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={() => setShowModal(true)}
          disabled={!salaId}
          className="btn-auxilio-pulse bg-red-500 hover:bg-red-600 disabled:bg-gray-300 disabled:shadow-none text-white font-bold text-lg uppercase tracking-wider py-5 px-12 rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed disabled:animate-none"
        >
          🚨 Chamar Auxílio
        </button>
        {!salaId && (
          <p className="text-sm text-gray-400">Selecione uma sala para habilitar o botão</p>
        )}
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={`text-sm px-4 py-3 rounded-lg text-center ${
            feedback.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
          }`}
        >
          {feedback.msg}
        </div>
      )}

      {/* Modal de auxílio */}
      {showModal && (
        <div className="fixed inset-0 z-[999] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 modal-enter">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Solicitar Auxílio</h3>
            <form onSubmit={handleChamarAuxilio} className="space-y-4">
              <div>
                <label htmlFor="tipo" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Tipo de ocorrência
                </label>
                <select
                  id="tipo"
                  value={tipoCrise}
                  onChange={(e) => setTipoCrise(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-sm bg-white"
                >
                  {TIPOS_CRISE.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="desc-auxilio" className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Descrição breve da situação
                </label>
                <textarea
                  id="desc-auxilio"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Descreva brevemente o que está acontecendo..."
                  rows={3}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-sm resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={enviando}
                  className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-semibold py-3 rounded-lg transition-colors cursor-pointer"
                >
                  {enviando ? "Enviando..." : "Confirmar Chamado"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
