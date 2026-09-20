"use client";

import { useState, useEffect, FormEvent } from "react";
import { useAuth } from "@/control/AuthContext";
import { apiService, CadastroNeurodivergente } from "@/model/api";

const CONDICOES = [
  { value: "", label: "Selecione uma condição" },
  { value: "TEA", label: "TEA - Transtorno do Espectro Autista" },
  { value: "TDAH", label: "TDAH - Transtorno do Déficit de Atenção e Hiperatividade" },
  { value: "Dislexia", label: "Dislexia" },
  { value: "Ansiedade Generalizada", label: "Ansiedade Generalizada" },
  { value: "TOC", label: "TOC - Transtorno Obsessivo-Compulsivo" },
  { value: "Outro", label: "Outro" },
];

export default function AlunoDashboard() {
  const { user } = useAuth();
  const [form, setForm] = useState<CadastroNeurodivergente>({
    condicao: "",
    descricao: "",
    necessidades: "",
    contato_emergencia: "",
  });
  const [jaCadastrado, setJaCadastrado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    const carregarPerfil = async () => {
      try {
        const perfil = await apiService.getPerfilAluno();
        if (perfil.cadastro_neurodivergente) {
          setForm(perfil.cadastro_neurodivergente);
          setJaCadastrado(true);
        }
      } catch {
        // Backend indisponível ou sem cadastro
      }
    };
    carregarPerfil();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      await apiService.cadastrarNeurodivergente(form);
      setFeedback({ type: "success", msg: "Cadastro salvo com sucesso!" });
      setJaCadastrado(true);
    } catch (err) {
      setFeedback({
        type: "error",
        msg: err instanceof Error ? err.message : "Erro ao salvar cadastro.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Olá, {user?.nome}!
        </h2>
        <p className="text-gray-500 mt-1">Bem-vindo ao seu painel do StudentCare.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-900">Cadastro de Neurodivergência</h3>
          <p className="text-sm text-gray-500 mt-1">
            Suas informações são confidenciais e serão usadas para que a universidade possa oferecer melhor acolhimento e suporte.
          </p>
          {jaCadastrado && (
            <div className="mt-3 inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-sm font-medium px-3 py-1.5 rounded-full">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Cadastro já realizado
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="condicao" className="block text-sm font-semibold text-gray-700 mb-1.5">
              Condição
            </label>
            <select
              id="condicao"
              value={form.condicao}
              onChange={(e) => setForm({ ...form, condicao: e.target.value })}
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-sm bg-white"
            >
              {CONDICOES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="descricao" className="block text-sm font-semibold text-gray-700 mb-1.5">
              Descrição
            </label>
            <textarea
              id="descricao"
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              placeholder="Descreva sua condição e como ela se manifesta no dia a dia..."
              rows={4}
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-sm resize-none"
            />
          </div>

          <div>
            <label htmlFor="necessidades" className="block text-sm font-semibold text-gray-700 mb-1.5">
              Necessidades específicas em sala de aula
            </label>
            <input
              id="necessidades"
              type="text"
              value={form.necessidades}
              onChange={(e) => setForm({ ...form, necessidades: e.target.value })}
              placeholder="Ex.: lugar calmo, pausas frequentes, fone de ouvido..."
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-sm"
            />
          </div>

          <div>
            <label htmlFor="contato" className="block text-sm font-semibold text-gray-700 mb-1.5">
              Contato de emergência
            </label>
            <input
              id="contato"
              type="tel"
              value={form.contato_emergencia}
              onChange={(e) => setForm({ ...form, contato_emergencia: e.target.value })}
              placeholder="(00) 00000-0000"
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-sm"
            />
          </div>

          {feedback && (
            <div
              className={`text-sm px-4 py-3 rounded-lg ${
                feedback.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
              }`}
            >
              {feedback.msg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-600 disabled:bg-emerald-400 text-white font-semibold py-3 px-8 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? "Salvando..." : "Salvar Cadastro"}
          </button>
        </form>
      </div>
    </div>
  );
}
