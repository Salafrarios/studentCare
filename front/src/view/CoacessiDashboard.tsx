"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/control/AuthContext";
import { apiService, Alerta, Estatisticas } from "@/model/api";
import { useNotifications } from "@/control/useNotifications";

export default function CoacessiDashboard() {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [stats, setStats] = useState<Estatisticas>({ total_alertas_hoje: 0, falsos_alarmes: 0, crises_confirmadas: 0, em_analise: 0 });
  const [selectedAlerta, setSelectedAlerta] = useState<Alerta | null>(null);
  const [resultado, setResultado] = useState<"confirmado" | "falso_alarme">("confirmado");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
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

  const handleResolver = async () => {
    if (!selectedAlerta) return;
    setSalvando(true);
    setFeedback(null);
    try {
      await apiService.resolverAlerta(selectedAlerta.id, { resultado, observacao });
      setFeedback({ type: "success", msg: "Análise salva com sucesso!" });
      setSelectedAlerta(null);
      setObservacao("");
      setResultado("confirmado");
      carregarDados();
    } catch (err) {
      setFeedback({
        type: "error",
        msg: err instanceof Error ? err.message : "Erro ao salvar análise.",
      });
    } finally {
      setSalvando(false);
    }
  };

  const statusConfig: Record<string, { label: string; badge: string; border: string }> = {
    novo: { label: "Novo", badge: "bg-amber-100 text-amber-700", border: "border-l-amber-400" },
    em_analise: { label: "Em análise", badge: "bg-emerald-100 text-emerald-700", border: "border-l-emerald-500" },
    resolvido: { label: "Resolvido", badge: "bg-gray-100 text-gray-500", border: "border-l-gray-300" },
  };

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
              return (
                <button
                  key={alerta.id}
                  onClick={() => { setSelectedAlerta(alerta); setResultado("confirmado"); setObservacao(""); }}
                  className={`w-full text-left bg-white rounded-xl border border-gray-100 border-l-4 ${config.border} p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-semibold text-gray-900">{alerta.tipo_crise}</span>
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${config.badge}`}>
                          {config.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>📍 {alerta.sala}</span>
                        <span>🕐 {new Date(alerta.timestamp).toLocaleString("pt-BR")}</span>
                        <span>Confiança: {Math.round(alerta.confianca * 100)}%</span>
                      </div>
                      {alerta.aluno_info && (
                        <p className="text-sm text-gray-500 mt-1">
                          Aluno: {alerta.aluno_info.nome} — {alerta.aluno_info.condicao}
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
              {/* Info do alerta */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <p><strong>Tipo:</strong> {selectedAlerta.tipo_crise}</p>
                <p><strong>Sala:</strong> {selectedAlerta.sala}</p>
                <p><strong>Data/Hora:</strong> {new Date(selectedAlerta.timestamp).toLocaleString("pt-BR")}</p>
                <p><strong>Confiança do modelo:</strong> {Math.round(selectedAlerta.confianca * 100)}%</p>
              </div>

              {/* Info do aluno */}
              {selectedAlerta.aluno_info && (
                <div className="bg-emerald-50 rounded-lg p-4 space-y-1 text-sm">
                  <p className="font-semibold text-emerald-800 mb-1">Informações do Aluno</p>
                  <p><strong>Nome:</strong> {selectedAlerta.aluno_info.nome}</p>
                  <p><strong>Condição:</strong> {selectedAlerta.aluno_info.condicao}</p>
                  <p><strong>Contato de emergência:</strong> {selectedAlerta.aluno_info.contato_emergencia}</p>
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

              {/* Classificação */}
              {selectedAlerta.status !== "resolvido" && (
                <div className="border-t pt-4">
                  <p className="font-semibold text-gray-900 mb-3">Classificação</p>
                  <div className="flex gap-3 mb-4">
                    <button
                      type="button"
                      onClick={() => setResultado("confirmado")}
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
                      onClick={() => setResultado("falso_alarme")}
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
                      Observação
                    </label>
                    <textarea
                      id="obs"
                      value={observacao}
                      onChange={(e) => setObservacao(e.target.value)}
                      placeholder="Adicione uma observação sobre esta análise..."
                      rows={3}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-sm resize-none"
                    />
                  </div>
                  <button
                    onClick={handleResolver}
                    disabled={salvando}
                    className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:bg-emerald-400 text-white font-semibold py-3 rounded-lg transition-colors cursor-pointer"
                  >
                    {salvando ? "Salvando..." : "Salvar Análise"}
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
