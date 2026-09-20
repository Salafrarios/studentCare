"use client";

import { useState, useEffect, FormEvent, useCallback } from "react";
import { useAuth } from "@/control/AuthContext";
import { apiService, Sala, NovaSala } from "@/model/api";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [salas, setSalas] = useState<Sala[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "ativo" | "manutencao" | "inativo">("todos");
  const [salaEmTeste, setSalaEmTeste] = useState<Sala | null>(null);

  // Formulário de nova sala
  const [formData, setFormData] = useState<NovaSala>({
    nome: "",
    bloco: "",
    capacidade: 40,
    camera_url: "",
    status: "ativo",
    descricao: "",
  });

  const carregarSalas = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.getSalas();
      setSalas(data);
    } catch (err) {
      setFeedback({
        type: "error",
        msg: err instanceof Error ? err.message : "Erro ao carregar salas.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Atualiza a lista a cada 10s, sem precisar recarregar a página.
  useEffect(() => {
    carregarSalas();
    const intervalId = setInterval(carregarSalas, 10000);
    return () => clearInterval(intervalId);
  }, [carregarSalas]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) return;

    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await apiService.cadastrarSala(formData);
      setFeedback({ type: "success", msg: res.message || "Sala cadastrada com sucesso!" });
      // Limpa formulário
      setFormData({
        nome: "",
        bloco: "",
        capacidade: 40,
        camera_url: "",
        status: "ativo",
        descricao: "",
      });
      carregarSalas();
    } catch (err) {
      setFeedback({
        type: "error",
        msg: err instanceof Error ? err.message : "Erro ao cadastrar sala.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoverSala = async (id: string, nome: string) => {
    if (!confirm(`Deseja realmente remover a ${nome}?`)) return;

    try {
      await apiService.removerSala(id);
      setFeedback({ type: "success", msg: `Sala ${nome} removida com sucesso!` });
      carregarSalas();
    } catch (err) {
      setFeedback({
        type: "error",
        msg: err instanceof Error ? err.message : "Erro ao remover sala.",
      });
    }
  };

  const handleAlternarStatus = async (sala: Sala) => {
    const proximoStatus: Record<string, "ativo" | "manutencao" | "inativo"> = {
      ativo: "manutencao",
      manutencao: "inativo",
      inativo: "ativo",
    };

    const novoStatus = proximoStatus[sala.status] || "ativo";
    try {
      await apiService.atualizarSala(sala.id, { status: novoStatus });
      carregarSalas();
    } catch (err) {
      setFeedback({
        type: "error",
        msg: err instanceof Error ? err.message : "Erro ao atualizar status da sala.",
      });
    }
  };

  // Métricas calculadas
  const totalSalas = salas.length;
  const salasAtivas = salas.filter((s) => s.status === "ativo").length;
  const salasManutencao = salas.filter((s) => s.status === "manutencao").length;
  const capacidadeTotal = salas.reduce((acc, curr) => acc + (curr.capacidade || 0), 0);

  const salasFiltradas = salas.filter((s) => {
    if (filtroStatus === "todos") return true;
    return s.status === filtroStatus;
  });

  const statusBadgeStyle = {
    ativo: "bg-emerald-100 text-emerald-800 border-emerald-200",
    manutencao: "bg-amber-100 text-amber-800 border-amber-200",
    inativo: "bg-gray-100 text-gray-700 border-gray-200",
  };

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Módulo Administrador de TI
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Gestão de Salas & Câmeras
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Conectado como <strong className="text-gray-800">{user?.nome}</strong> ({user?.email})
          </p>
        </div>

        <button
          onClick={carregarSalas}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 bg-white border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-colors shadow-sm cursor-pointer disabled:opacity-50 self-start sm:self-auto"
        >
          <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Atualizar Lista
        </button>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Total de Salas</p>
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-700">🏢</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-2">{totalSalas}</p>
          <p className="text-xs text-gray-400 mt-1">Pontos de monitoramento</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-emerald-700">Câmeras Ativas</p>
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600">📹</span>
          </div>
          <p className="text-3xl font-bold text-emerald-700 mt-2">{salasAtivas}</p>
          <p className="text-xs text-emerald-600/70 mt-1">Transmitindo normalmente</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-amber-700">Em Manutenção</p>
            <span className="p-2 rounded-lg bg-amber-50 text-amber-600">⚠️</span>
          </div>
          <p className="text-3xl font-bold text-amber-600 mt-2">{salasManutencao}</p>
          <p className="text-xs text-amber-600/70 mt-1">Requer atenção do suporte</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Capacidade Total</p>
            <span className="p-2 rounded-lg bg-gray-50 text-gray-600">👥</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-2">{capacidadeTotal}</p>
          <p className="text-xs text-gray-400 mt-1">Alunos simultâneos</p>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{feedback.type === "success" ? "✓" : "⚠"}</span>
            <p>{feedback.msg}</p>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs underline opacity-70 hover:opacity-100 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Layout em 2 colunas: Formulário de Cadastro e Tabela */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Formulário de Cadastro de Sala */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 lg:sticky lg:top-24">
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Cadastrar Nova Sala</h3>
              <p className="text-xs text-gray-500">Adiciona sala e câmera ao sistema</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="nome" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Nome / Identificação *
              </label>
              <input
                id="nome"
                type="text"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex.: Sala 104, Lab. Multimídia"
                required
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="bloco" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Bloco / Pavilhão
                </label>
                <input
                  id="bloco"
                  type="text"
                  value={formData.bloco}
                  onChange={(e) => setFormData({ ...formData, bloco: e.target.value })}
                  placeholder="Ex.: Bloco C - 1º Andar"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm"
                />
              </div>

              <div>
                <label htmlFor="capacidade" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Capacidade (Alunos)
                </label>
                <input
                  id="capacidade"
                  type="number"
                  min="1"
                  max="500"
                  value={formData.capacidade || ""}
                  onChange={(e) => setFormData({ ...formData, capacidade: Number(e.target.value) })}
                  placeholder="40"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="camera_url" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                URL da Câmera IP (usada quando a detecção estiver em modo &quot;Câmera IP&quot;)
              </label>
              <input
                id="camera_url"
                type="text"
                value={formData.camera_url}
                onChange={(e) => setFormData({ ...formData, camera_url: e.target.value })}
                placeholder="rtsp://camera.universidade.edu.br/stream/sala-104"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm font-mono"
              />
            </div>

            <div>
              <label htmlFor="status" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Status Inicial
              </label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as "ativo" | "manutencao" | "inativo" })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm bg-white"
              >
                <option value="ativo">🟢 Ativo (Câmera operacional)</option>
                <option value="manutencao">🟡 Em Manutenção / Calibração</option>
                <option value="inativo">⚪ Inativo</option>
              </select>
            </div>

            <div>
              <label htmlFor="descricao" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Observações de Infraestrutura
              </label>
              <textarea
                id="descricao"
                rows={2}
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Ex.: Câmera instalada no ângulo frontal, switch porta 08..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:bg-emerald-400 text-white font-semibold py-3 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed shadow-md text-sm mt-2"
            >
              {submitting ? "Cadastrando Sala..." : "Salvar Sala no Sistema"}
            </button>
          </form>
        </div>

        {/* Lista e Tabela de Salas */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Salas Monitoradas</h3>
                <p className="text-xs text-gray-500">Salas disponíveis para o monitoramento de crises</p>
              </div>

              {/* Filtro por status */}
              <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-lg self-start sm:self-auto text-xs font-medium">
                {(["todos", "ativo", "manutencao", "inativo"] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setFiltroStatus(st)}
                    className={`px-3 py-1.5 rounded-md capitalize transition-all cursor-pointer ${
                      filtroStatus === st
                        ? "bg-white text-emerald-800 shadow-xs font-semibold"
                        : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    {st === "todos" ? "Todas" : st}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="py-16 text-center text-gray-400">
                <svg className="animate-spin w-8 h-8 mx-auto text-emerald-600 mb-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm">Carregando salas cadastradas...</p>
              </div>
            ) : salasFiltradas.length === 0 ? (
              <div className="py-12 text-center text-gray-400 border border-dashed border-gray-200 rounded-xl">
                <p className="text-sm">Nenhuma sala encontrada com este filtro.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {salasFiltradas.map((sala) => (
                  <div key={sala.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/70 px-3 rounded-xl transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-gray-900 text-base">{sala.nome}</span>
                        <button
                          onClick={() => handleAlternarStatus(sala)}
                          title="Clique para alternar o status"
                          className={`text-xs px-2.5 py-0.5 rounded-full font-medium border cursor-pointer ${
                            statusBadgeStyle[sala.status]
                          }`}
                        >
                          {sala.status === "ativo" ? "Ativo" : sala.status === "manutencao" ? "Manutenção" : "Inativo"}
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                        {sala.bloco && <span>📍 {sala.bloco}</span>}
                        {sala.capacidade && <span>👥 {sala.capacidade} lugares</span>}
                        <span className="font-mono text-gray-400 truncate max-w-xs">
                          📹 {sala.camera_url || "Sem URL configurada"}
                        </span>
                      </div>

                      {sala.descricao && (
                        <p className="text-xs text-gray-500 italic mt-0.5">{sala.descricao}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <button
                        onClick={() => setSalaEmTeste(sala)}
                        className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                        title="Testar feed da câmera"
                      >
                        Testar Câmera
                      </button>

                      <button
                        onClick={() => handleRemoverSala(sala.id, sala.nome)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Remover sala"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Teste de Câmera */}
      {salaEmTeste && (
        <div className="fixed inset-0 z-[999] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 modal-enter">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-bold text-gray-900 text-lg">Teste de Feed — {salaEmTeste.nome}</h4>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{salaEmTeste.camera_url}</p>
              </div>
              <button
                onClick={() => setSalaEmTeste(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-black rounded-xl aspect-video relative flex items-center justify-center overflow-hidden mb-4">
              <div className="text-center p-6 text-gray-400">
                <div className="w-12 h-12 rounded-full border-2 border-dashed border-emerald-500 animate-spin mx-auto mb-3" />
                <p className="text-sm font-medium text-white">Conectando ao Stream RTSP / WebRTC...</p>
                <p className="text-xs text-gray-400 mt-1">Aguardando pacote de vídeo do backend FastAPI</p>
              </div>
              <div className="absolute top-3 left-3 bg-black/70 px-2.5 py-1 rounded-md text-[11px] text-emerald-400 font-mono flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                REC 1080p
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSalaEmTeste(null)}
                className="px-5 py-2 text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors cursor-pointer"
              >
                Fechar Teste
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
