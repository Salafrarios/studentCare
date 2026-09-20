"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/control/AuthContext";
import { apiService, Alerta, Estatisticas, StatusAlerta } from "@/model/api";
import { useNotifications } from "@/control/useNotifications";

export default function CoacessiDashboard() {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [stats, setStats] = useState<Estatisticas>({ total_alertas_hoje: 0, falsos_alarmes: 0, crises_confirmadas: 0, em_analise: 0 });
  const [selectedAlerta, setSelectedAlerta] = useState<Alerta | null>(null);
  const [proximoStatus, setProximoStatus] = useState<StatusAlerta>("em_analise");
  const [descricaoIntervencao, setDescricaoIntervencao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [assumindo, setAssumindo] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

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
    const interval = setInterval(carregarDados, 15000);
    return () => clearInterval(interval);
  }, [carregarDados]);

  const handleAssumir = async () => {
    if (!selectedAlerta) return;
    setAssumindo(true);
    setFeedback(null);
    try {
      const res = await apiService.atribuirAlerta(selectedAlerta.id);
      setFeedback({ type: "success", msg: res.message });
      await carregarDados();
      setSelectedAlerta((prev) => (prev ? { ...prev, profissional_atribuido: res.profissional } : prev));
    } catch (err) {
      setFeedback({
        type: "error",
        msg: err instanceof Error ? err.message : "Erro ao assumir o alerta.",
      });
    } finally {
      setAssumindo(false);
    }
  };

  const handleSalvarAcao = async () => {
    if (!selectedAlerta) return;
    setSalvando(true);
    setFeedback(null);
    try {
      if (descricaoIntervencao.trim()) {
        await apiService.registrarIntervencao(selectedAlerta.id, descricaoIntervencao.trim());
      }
      if (proximoStatus !== selectedAlerta.status) {
        await apiService.atualizarStatusAlerta(selectedAlerta.id, proximoStatus);
      }
      setFeedback({ type: "success", msg: "Ação registrada com sucesso!" });
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
    suporte_em_progresso: { label: "Suporte em andamento", badge: "bg-sky-100 text-sky-700", border: "border-l-sky-400" },
    resolvido: { label: "Resolvido", badge: "bg-gray-100 text-gray-500", border: "border-l-gray-300" },
    descartado: { label: "Descartado", badge: "bg-slate-100 text-slate-400", border: "border-l-slate-200" },
  };

  const prioridadeConfig: Record<string, { label: string; badge: string }> = {
    alta: { label: "Prioridade alta", badge: "bg-red-50 text-red-600" },
    media: { label: "Prioridade média", badge: "bg-amber-50 text-amber-600" },
    baixa: { label: "Prioridade baixa", badge: "bg-gray-50 text-gray-500" },
  };

  const statusSelecionavel: { value: StatusAlerta; label: string }[] = [
    { value: "em_analise", label: "Em análise" },
    { value: "suporte_em_progresso", label: "Suporte em andamento" },
    { value: "resolvido", label: "Resolvido" },
    { value: "descartado", label: "Descartado (falso positivo)" },
  ];

  const statCards = [
    { label: "Total de Alertas Hoje", value: stats.total_alertas_hoje, color: "text-gray-900", bg: "bg-white" },
    { label: "Crises Confirmadas", value: stats.crises_confirmadas, color: "text-red-600", bg: "bg-red-50" },
    { label: "Falsos Alarmes", value: stats.falsos_alarmes, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Em Análise", value: stats.em_analise, color: "text-emerald-700", bg: "bg-emerald-50" },
  ];

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
        <h3 className="text-lg font-bold text-gray-900 mb-4">Alertas Ativos</h3>
        {alertas.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>Nenhum alerta ativo no momento.</p>
            <p className="text-sm mt-1">Os alertas aparecerão aqui quando crises forem detectadas.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alertas.map((alerta) => {
              const config = statusConfig[alerta.status] || statusConfig.novo;
              const prioridade = prioridadeConfig[alerta.prioridade];
              return (
                <button
                  key={alerta.id}
                  onClick={() => {
                    setSelectedAlerta(alerta);
                    setProximoStatus(alerta.status === "novo" ? "em_analise" : alerta.status);
                    setDescricaoIntervencao("");
                  }}
                  className={`w-full text-left bg-white rounded-xl border border-gray-100 border-l-4 ${config.border} p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{alerta.indicador_comportamental}</span>
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${config.badge}`}>
                          {config.label}
                        </span>
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${prioridade.badge}`}>
                          {prioridade.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
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
                    <svg className="w-5 h-5 text-gray-400 shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
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
              <h3 className="text-lg font-bold text-gray-900">Detalhes do Alerta</h3>
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
              {/* Aviso de responsabilidade humana */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                Este alerta é um indicador que requer avaliação humana — não é uma crise confirmada nem um diagnóstico.
                As previsões do modelo de visão computacional podem estar incorretas.
              </div>

              {/* Info do alerta */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <p><strong>Indicador observado:</strong> {selectedAlerta.indicador_comportamental}</p>
                <p><strong>Sala:</strong> {selectedAlerta.sala}</p>
                <p><strong>Data/Hora:</strong> {new Date(selectedAlerta.timestamp).toLocaleString("pt-BR")}</p>
                <p><strong>Confiança do modelo:</strong> {Math.round(selectedAlerta.confianca * 100)}%</p>
                <p><strong>Prioridade:</strong> {prioridadeConfig[selectedAlerta.prioridade].label}</p>
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
                  <p><strong>Condição:</strong> {selectedAlerta.aluno_info.condicao}</p>
                  {selectedAlerta.aluno_info.comunicacao_preferida && (
                    <p><strong>Comunicação preferida:</strong> {selectedAlerta.aluno_info.comunicacao_preferida}</p>
                  )}
                  {selectedAlerta.aluno_info.diretrizes_apoio && (
                    <p><strong>Diretrizes de apoio autorizadas:</strong> {selectedAlerta.aluno_info.diretrizes_apoio}</p>
                  )}
                  {selectedAlerta.aluno_info.contato_emergencia && (
                    <p><strong>Contato de emergência:</strong> {selectedAlerta.aluno_info.contato_emergencia}</p>
                  )}
                </div>
              )}

              {/* Snapshot placeholder */}
              <div className="bg-black rounded-lg aspect-video flex items-center justify-center text-gray-500 text-sm">
                {selectedAlerta.snapshot_url ? (
                  <img src={selectedAlerta.snapshot_url} alt="Snapshot da câmera" className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <p>Snapshot da câmera indisponível</p>
                )}
              </div>

              {/* Histórico de intervenções */}
              <div className="border-t pt-4">
                <p className="font-semibold text-gray-900 mb-2">Histórico de Intervenções</p>
                {selectedAlerta.historico_intervencoes.length === 0 ? (
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

              {/* Ação */}
              {selectedAlerta.status !== "resolvido" && selectedAlerta.status !== "descartado" && (
                <div className="border-t pt-4">
                  <p className="font-semibold text-gray-900 mb-3">Registrar Ação</p>
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
                    {salvando ? "Salvando..." : "Salvar Ação"}
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
