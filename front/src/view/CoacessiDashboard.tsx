"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/control/AuthContext";
import { apiService, Alerta, Estatisticas, StatusAlerta, PrioridadeAlerta } from "@/model/api";
import { useNotifications } from "@/control/useNotifications";

type Ordenacao = "recentes" | "prioridade" | "confianca";

const PESO_PRIORIDADE: Record<PrioridadeAlerta, number> = { alta: 3, media: 2, baixa: 1 };

export default function CoacessiDashboard() {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [stats, setStats] = useState<Estatisticas>({
    total_alertas_hoje: 0,
    falsos_alarmes: 0,
    crises_confirmadas: 0,
    em_analise: 0,
    em_andamento: 0,
  });
  const [selectedAlerta, setSelectedAlerta] = useState<Alerta | null>(null);
  const [resultado, setResultado] = useState<"confirmado" | "falso_alarme">("confirmado");
  const [proximoStatus, setProximoStatus] = useState<StatusAlerta>("em_analise");
  const [descricaoIntervencao, setDescricaoIntervencao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [assumindo, setAssumindo] = useState(false);
  const [iniciandoAtendimento, setIniciandoAtendimento] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "novo" | "em_analise" | "em_andamento" | "resolvido">("todos");
  const [filtroPrioridade, setFiltroPrioridade] = useState<"todas" | PrioridadeAlerta>("todas");
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("recentes");
  const [dadosSensiveisRevelados, setDadosSensiveisRevelados] = useState(false);
  const [motivoAcesso, setMotivoAcesso] = useState("");
  const [revelandoDados, setRevelandoDados] = useState(false);

  const carregarDados = useCallback(async () => {
    try {
      const [alertasData, statsData] = await Promise.allSettled([
        apiService.getAlertas(),
        apiService.getEstatisticas(),
      ]);
      if (alertasData.status === "fulfilled") setAlertas(alertasData.value);
      if (statsData.status === "fulfilled") setStats(statsData.value);
    } catch {
      // Backend indisponível
    }
  }, []);

  useEffect(() => {
    carregarDados();
    const interval = setInterval(carregarDados, 10000);
    return () => clearInterval(interval);
  }, [carregarDados]);

  const handleIniciarAtendimento = async (alertaId?: string) => {
    const id = alertaId || selectedAlerta?.id;
    if (!id) return;
    setIniciandoAtendimento(true);
    setFeedback(null);
    try {
      await apiService.iniciarAtendimento(id);
      if (selectedAlerta && selectedAlerta.id === id) {
        setSelectedAlerta({
          ...selectedAlerta,
          status: "em_andamento",
          profissional_atribuido:
            selectedAlerta.profissional_atribuido || (user ? { id: user.id, nome: user.nome } : undefined),
        });
        setProximoStatus("em_andamento");
      }
      setFeedback({
        type: "success",
        msg: "Atendimento iniciado com sucesso! Status alterado para 'Em andamento'.",
      });
      carregarDados();
    } catch (err) {
      setFeedback({
        type: "error",
        msg: err instanceof Error ? err.message : "Erro ao iniciar atendimento.",
      });
    } finally {
      setIniciandoAtendimento(false);
    }
  };

  const handleAssumir = async () => {
    if (!selectedAlerta) return;
    setAssumindo(true);
    setFeedback(null);
    try {
      const res = await apiService.atribuirAlerta(selectedAlerta.id);
      setFeedback({ type: "success", msg: res.message });
      setSelectedAlerta((prev) => (prev ? { ...prev, profissional_atribuido: res.profissional } : prev));
      carregarDados();
    } catch (err) {
      setFeedback({
        type: "error",
        msg: err instanceof Error ? err.message : "Erro ao assumir o alerta.",
      });
    } finally {
      setAssumindo(false);
    }
  };

  const handleRevelarDadosSensiveis = async () => {
    if (!selectedAlerta || !motivoAcesso.trim()) return;
    setRevelandoDados(true);
    try {
      await apiService.registrarAcessoSensivel(selectedAlerta.id, motivoAcesso.trim());
      setDadosSensiveisRevelados(true);
    } catch (err) {
      setFeedback({
        type: "error",
        msg: err instanceof Error ? err.message : "Erro ao registrar o acesso.",
      });
    } finally {
      setRevelandoDados(false);
    }
  };

  const handleSalvarAcao = async () => {
    if (!selectedAlerta) return;
    setSalvando(true);
    setFeedback(null);
    try {
      if (proximoStatus === "resolvido" || proximoStatus === "descartado") {
        await apiService.resolverAlerta(selectedAlerta.id, {
          resultado: proximoStatus === "descartado" ? "falso_alarme" : resultado,
          observacao: descricaoIntervencao.trim() || undefined,
        });
        setFeedback({ type: "success", msg: "Atendimento concluído e análise salva com sucesso!" });
      } else {
        if (descricaoIntervencao.trim()) {
          await apiService.registrarIntervencao(selectedAlerta.id, descricaoIntervencao.trim());
        }
        if (proximoStatus !== selectedAlerta.status) {
          await apiService.atualizarStatusAlerta(selectedAlerta.id, proximoStatus);
        }
        setFeedback({ type: "success", msg: "Ação registrada com sucesso!" });
      }
      setSelectedAlerta(null);
      setDescricaoIntervencao("");
      carregarDados();
    } catch (err) {
      setFeedback({
        type: "error",
        msg: err instanceof Error ? err.message : "Erro ao salvar a ação.",
      });
    } finally {
      setSalvando(false);
    }
  };

  const statusConfig: Record<StatusAlerta, { label: string; badge: string; border: string }> = {
    novo: { label: "Novo", badge: "bg-amber-100 text-amber-700", border: "border-l-amber-400" },
    em_analise: { label: "Em análise", badge: "bg-emerald-100 text-emerald-700", border: "border-l-emerald-500" },
    em_andamento: { label: "Em andamento", badge: "bg-blue-100 text-blue-700", border: "border-l-blue-500" },
    suporte_em_progresso: { label: "Suporte em andamento", badge: "bg-sky-100 text-sky-700", border: "border-l-sky-400" },
    resolvido: { label: "Resolvido", badge: "bg-gray-100 text-gray-500", border: "border-l-gray-300" },
    descartado: { label: "Descartado", badge: "bg-slate-100 text-slate-400", border: "border-l-slate-200" },
  };

  const prioridadeConfig: Record<PrioridadeAlerta, { label: string; badge: string }> = {
    alta: { label: "Prioridade alta", badge: "bg-red-50 text-red-600" },
    media: { label: "Prioridade média", badge: "bg-amber-50 text-amber-600" },
    baixa: { label: "Prioridade baixa", badge: "bg-gray-50 text-gray-500" },
  };

  const statusSelecionavel: { value: StatusAlerta; label: string }[] = [
    { value: "em_analise", label: "Em análise" },
    { value: "em_andamento", label: "Em andamento" },
    { value: "suporte_em_progresso", label: "Suporte em andamento" },
    { value: "resolvido", label: "Resolvido" },
    { value: "descartado", label: "Descartado (falso positivo)" },
  ];

  const statCards = [
    { label: "Total de Alertas Hoje", value: stats.total_alertas_hoje, color: "text-gray-900", bg: "bg-white" },
    { label: "Crises Confirmadas", value: stats.crises_confirmadas, color: "text-red-600", bg: "bg-red-50" },
    { label: "Falsos Alarmes", value: stats.falsos_alarmes, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Em Análise", value: stats.em_analise, color: "text-emerald-700", bg: "bg-emerald-50" },
    { label: "Em Andamento", value: stats.em_andamento, color: "text-blue-700", bg: "bg-blue-50" },
  ];

  const alertasFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtrados = alertas.filter((a) => {
      if (filtroStatus === "em_andamento") {
        if (a.status !== "em_andamento" && a.status !== "suporte_em_progresso") return false;
      } else if (filtroStatus === "resolvido") {
        if (a.status !== "resolvido" && a.status !== "descartado") return false;
      } else if (filtroStatus !== "todos" && a.status !== filtroStatus) {
        return false;
      }

      if (filtroPrioridade !== "todas" && a.prioridade !== filtroPrioridade) return false;

      if (!termo) return true;
      const titulo = (a.indicador_comportamental || a.tipo_crise || "").toLowerCase();
      return (
        titulo.includes(termo) ||
        a.sala.toLowerCase().includes(termo) ||
        a.aluno_info?.nome.toLowerCase().includes(termo)
      );
    });

    return [...filtrados].sort((a, b) => {
      if (ordenacao === "prioridade") return PESO_PRIORIDADE[b.prioridade] - PESO_PRIORIDADE[a.prioridade];
      if (ordenacao === "confianca") return b.confianca - a.confianca;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [alertas, filtroStatus, filtroPrioridade, busca, ordenacao]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Painel de Monitoramento — COACESSI</h2>
          <p className="text-gray-500 mt-1">Olá, {user?.nome}</p>
        </div>
        {unreadCount > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2 rounded-full text-sm font-medium">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6z" />
              <path d="M10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
            </svg>
            {unreadCount}
          </div>
        )}
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className={`${card.bg} rounded-xl p-5 border border-gray-100 shadow-sm`}>
            <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-sm text-gray-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`text-sm px-4 py-3 rounded-lg ${feedback.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
          {feedback.msg}
        </div>
      )}

      {/* Lista de alertas */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-bold text-gray-900">Alertas e Atendimentos</h3>
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: "todos", label: "Todos", count: alertas.length },
              { id: "novo", label: "Novos", count: alertas.filter((a) => a.status === "novo").length },
              { id: "em_analise", label: "Em análise", count: alertas.filter((a) => a.status === "em_analise").length },
              {
                id: "em_andamento",
                label: "Em andamento",
                count: alertas.filter((a) => a.status === "em_andamento" || a.status === "suporte_em_progresso").length,
              },
              {
                id: "resolvido",
                label: "Resolvidos",
                count: alertas.filter((a) => a.status === "resolvido" || a.status === "descartado").length,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFiltroStatus(tab.id as typeof filtroStatus)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  filtroStatus === tab.id
                    ? "bg-gray-900 text-white shadow-xs"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    filtroStatus === tab.id ? "bg-gray-700 text-white" : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="relative flex-1">
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por aluno, sala ou indicador..."
              aria-label="Buscar alertas"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {(["todas", "alta", "media", "baixa"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setFiltroPrioridade(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
                  filtroPrioridade === p
                    ? "bg-gray-900 text-white shadow-xs"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {p === "todas" ? "Toda prioridade" : p}
              </button>
            ))}
          </div>

          <select
            value={ordenacao}
            onChange={(e) => setOrdenacao(e.target.value as Ordenacao)}
            aria-label="Ordenar alertas"
            className="shrink-0 px-3 py-2 rounded-lg border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm bg-white text-gray-700"
          >
            <option value="recentes">Mais recentes</option>
            <option value="prioridade">Maior prioridade</option>
            <option value="confianca">Maior confiança</option>
          </select>
        </div>

        {alertasFiltrados.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>Nenhum alerta {filtroStatus !== "todos" ? `com status "${statusConfig[filtroStatus]?.label || filtroStatus}"` : "ativo"} no momento.</p>
            <p className="text-sm mt-1">Os alertas aparecerão aqui quando crises forem detectadas ou solicitadas.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alertasFiltrados.map((alerta) => {
              const config = statusConfig[alerta.status] || statusConfig.novo;
              const prioridade = prioridadeConfig[alerta.prioridade] || prioridadeConfig.media;
              const tituloAlerta = alerta.indicador_comportamental || alerta.tipo_crise || "Ocorrência observada";
              return (
                <div
                  key={alerta.id}
                  onClick={() => {
                    setSelectedAlerta(alerta);
                    setProximoStatus(
                      alerta.status === "novo"
                        ? "em_analise"
                        : alerta.status === "em_andamento" || alerta.status === "suporte_em_progresso"
                        ? "resolvido"
                        : alerta.status
                    );
                    setResultado("confirmado");
                    setDescricaoIntervencao("");
                    setDadosSensiveisRevelados(false);
                    setMotivoAcesso("");
                  }}
                  className={`w-full text-left bg-white rounded-xl border border-gray-100 border-l-4 ${config.border} p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{tituloAlerta}</span>
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${config.badge}`}>
                          {(alerta.status === "em_andamento" || alerta.status === "suporte_em_progresso") && (
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                            </span>
                          )}
                          {config.label}
                        </span>
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${prioridade.badge}`}>
                          {prioridade.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                        <span>📍 {alerta.sala}</span>
                        <span>🕐 {new Date(alerta.timestamp).toLocaleString("pt-BR")}</span>
                        <span>Confiança do modelo: {Math.round(alerta.confianca * 100)}%</span>
                      </div>
                      {alerta.aluno_info && (
                        <p className="text-sm text-gray-500 mt-1">
                          Aluno: {alerta.aluno_info.nome} — {alerta.aluno_info.condicao}
                        </p>
                      )}
                      {alerta.profissional_atribuido && (
                        <p className="text-sm text-gray-400 mt-1">
                          Responsável: {alerta.profissional_atribuido.nome}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(alerta.status === "novo" || alerta.status === "em_analise") && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleIniciarAtendimento(alerta.id);
                          }}
                          disabled={iniciandoAtendimento}
                          className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                          title="Iniciar atendimento para este chamado"
                        >
                          <span>▶</span> Iniciar Atendimento
                        </button>
                      )}
                      <svg className="w-5 h-5 text-gray-400 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de detalhes do alerta */}
      {selectedAlerta && (
        <div className="fixed inset-0 z-[999] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 modal-enter max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg font-bold text-gray-900">Detalhes do Alerta</h3>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusConfig[selectedAlerta.status]?.badge || statusConfig.novo.badge}`}>
                  {statusConfig[selectedAlerta.status]?.label || selectedAlerta.status}
                </span>
              </div>
              <button
                onClick={() => setSelectedAlerta(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Status banner / Ação de Iniciar Atendimento */}
              {(selectedAlerta.status === "em_andamento" || selectedAlerta.status === "suporte_em_progresso") && (
                <div className="flex items-center gap-3 p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-sm">
                  <span className="relative flex h-3 w-3 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-600"></span>
                  </span>
                  <div>
                    <p className="font-semibold text-blue-900">Atendimento em Andamento</p>
                    <p className="text-xs text-blue-700 mt-0.5">
                      O atendimento foi requisitado e iniciado. Após prestar o auxílio necessário, preencha a classificação abaixo para concluir.
                    </p>
                  </div>
                </div>
              )}

              {(selectedAlerta.status === "novo" || selectedAlerta.status === "em_analise") && (
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
                  <div>
                    <p className="font-semibold text-amber-900 text-sm">Atendimento Requisitado</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      O alerta foi recebido e aguarda início do atendimento pela equipe. Inicie para sinalizar que a ocorrência está sob cuidados.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleIniciarAtendimento()}
                    disabled={iniciandoAtendimento}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors cursor-pointer text-sm flex items-center justify-center gap-2 shadow-xs"
                  >
                    {iniciandoAtendimento ? (
                      <>
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Iniciando atendimento...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Iniciar Atendimento (Marcar como Em Andamento)
                      </>
                    )}
                  </button>
                </div>
              )}

              {selectedAlerta.status === "resolvido" && (
                <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 text-sm">
                  <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="font-semibold text-gray-800">Atendimento Concluído & Resolvido</span>
                </div>
              )}

              {selectedAlerta.status === "descartado" && (
                <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm">
                  <svg className="w-5 h-5 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="font-semibold text-slate-800">Alerta Descartado (Falso Positivo)</span>
                </div>
              )}

              {/* Info do alerta */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <p><strong>Indicador observado:</strong> {selectedAlerta.indicador_comportamental || selectedAlerta.tipo_crise || "Não especificado"}</p>
                <p><strong>Sala:</strong> {selectedAlerta.sala}</p>
                <p><strong>Data/Hora:</strong> {new Date(selectedAlerta.timestamp).toLocaleString("pt-BR")}</p>
                <p><strong>Confiança do modelo:</strong> {Math.round(selectedAlerta.confianca * 100)}%</p>
                <p><strong>Prioridade:</strong> {(prioridadeConfig[selectedAlerta.prioridade] || prioridadeConfig.media).label}</p>
                <p>
                  <strong>Profissional responsável:</strong>{" "}
                  {selectedAlerta.profissional_atribuido?.nome || "Ninguém assumiu este alerta ainda"}
                </p>
              </div>

              {!selectedAlerta.profissional_atribuido && (
                <button
                  onClick={handleAssumir}
                  disabled={assumindo}
                  className="w-full bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 font-medium py-2.5 rounded-lg transition-colors cursor-pointer text-sm"
                >
                  {assumindo ? "Assumindo..." : "Assumir este alerta"}
                </button>
              )}

              {/* Info do aluno */}
              {selectedAlerta.aluno_info && (
                <div className="bg-emerald-50 rounded-lg p-4 space-y-1 text-sm">
                  <p className="font-semibold text-emerald-800 mb-1">Informações e Preferências do Aluno</p>
                  <p><strong>Nome:</strong> {selectedAlerta.aluno_info.nome}</p>
                  {selectedAlerta.aluno_info.comunicacao_preferida && (
                    <p><strong>Comunicação preferida:</strong> {selectedAlerta.aluno_info.comunicacao_preferida}</p>
                  )}
                  {selectedAlerta.aluno_info.diretrizes_apoio && (
                    <p><strong>Diretrizes de apoio autorizadas:</strong> {selectedAlerta.aluno_info.diretrizes_apoio}</p>
                  )}

                  {dadosSensiveisRevelados ? (
                    <>
                      <p><strong>Condição:</strong> {selectedAlerta.aluno_info.condicao}</p>
                      {selectedAlerta.aluno_info.contato_emergencia && (
                        <p><strong>Contato de emergência:</strong> {selectedAlerta.aluno_info.contato_emergencia}</p>
                      )}
                    </>
                  ) : (
                    <div className="pt-2 mt-2 border-t border-emerald-100 space-y-2">
                      <p className="text-xs text-emerald-700">
                        Condição e contato de emergência são dados sensíveis — informe o motivo do acesso para revelá-los. Esta ação fica registrada.
                      </p>
                      <input
                        type="text"
                        value={motivoAcesso}
                        onChange={(e) => setMotivoAcesso(e.target.value)}
                        placeholder="Motivo do acesso (ex.: contato com a família necessário)"
                        className="w-full px-3 py-2 rounded-lg border border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-xs bg-white"
                      />
                      <button
                        type="button"
                        onClick={handleRevelarDadosSensiveis}
                        disabled={!motivoAcesso.trim() || revelandoDados}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:bg-emerald-300 text-white transition-colors cursor-pointer"
                      >
                        {revelandoDados ? "Registrando acesso..." : "Revelar dados sensíveis"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Snapshot placeholder */}
              <div className="bg-black rounded-lg aspect-video flex items-center justify-center text-gray-500 text-sm">
                {selectedAlerta.snapshot_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={selectedAlerta.snapshot_url} alt="Snapshot da câmera" className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <p>Snapshot da câmera indisponível</p>
                )}
              </div>

              {/* Histórico de intervenções */}
              <div className="border-t pt-4">
                <p className="font-semibold text-gray-900 mb-2">Histórico de Intervenções</p>
                {!selectedAlerta.historico_intervencoes || selectedAlerta.historico_intervencoes.length === 0 ? (
                  <p className="text-sm text-gray-400">Nenhuma intervenção registrada ainda.</p>
                ) : (
                  <ul className="space-y-2">
                    {selectedAlerta.historico_intervencoes.map((intervencao) => (
                      <li key={intervencao.id} className="text-sm bg-gray-50 rounded-lg p-3">
                        <p className="text-gray-800">{intervencao.descricao}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {intervencao.profissional.nome} — {new Date(intervencao.timestamp).toLocaleString("pt-BR")}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Classificação / Resolução */}
              {selectedAlerta.status !== "resolvido" && selectedAlerta.status !== "descartado" && (
                <div className="border-t pt-4">
                  <p className="font-semibold text-gray-900 mb-3">
                    {selectedAlerta.status === "em_andamento" || selectedAlerta.status === "suporte_em_progresso"
                      ? "Finalizar Atendimento & Classificação"
                      : "Classificação do Alerta"}
                  </p>
                  <div className="flex gap-3 mb-4">
                    <button
                      type="button"
                      onClick={() => {
                        setResultado("confirmado");
                        setProximoStatus("resolvido");
                      }}
                      className={`flex-1 py-3 rounded-lg font-medium text-sm transition-all cursor-pointer ${
                        resultado === "confirmado"
                          ? "bg-red-500 text-white shadow-md"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      Confirmar Crise
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResultado("falso_alarme");
                        setProximoStatus("descartado");
                      }}
                      className={`flex-1 py-3 rounded-lg font-medium text-sm transition-all cursor-pointer ${
                        resultado === "falso_alarme"
                          ? "bg-amber-500 text-white shadow-md"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      Falso Alarme
                    </button>
                  </div>
                  <div className="mb-4">
                    <label htmlFor="obs" className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Descrição da intervenção (opcional)
                    </label>
                    <textarea
                      id="obs"
                      value={descricaoIntervencao}
                      onChange={(e) => setDescricaoIntervencao(e.target.value)}
                      placeholder="Descreva a ação tomada nesta etapa..."
                      rows={3}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-sm resize-none"
                    />
                  </div>
                  <div className="mb-4">
                    <label htmlFor="status" className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Atualizar status para
                    </label>
                    <select
                      id="status"
                      value={proximoStatus}
                      onChange={(e) => setProximoStatus(e.target.value as StatusAlerta)}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm bg-white"
                    >
                      {statusSelecionavel.map((opcao) => (
                        <option key={opcao.value} value={opcao.value}>{opcao.label}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleSalvarAcao}
                    disabled={salvando}
                    className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:bg-emerald-400 text-white font-semibold py-3 rounded-lg transition-colors cursor-pointer"
                  >
                    {salvando
                      ? "Salvando..."
                      : selectedAlerta.status === "em_andamento" || selectedAlerta.status === "suporte_em_progresso"
                      ? "Concluir Atendimento & Salvar"
                      : "Salvar Análise"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
