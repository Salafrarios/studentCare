"use client";

import { useState, useEffect, FormEvent } from "react";
import { useAuth } from "@/control/AuthContext";
import { apiService, CadastroNeurodivergente } from "@/model/api";

export interface OpcaoTranstorno {
  value: string;
  label: string;
  descricao: string;
}

const OPCOES_TRANSTORNOS: OpcaoTranstorno[] = [
  {
    value: "TEA",
    label: "TEA - Transtorno do Espectro Autista",
    descricao: "Sensibilidade sensorial, comunicação, interação ou necessidade de rotinas",
  },
  {
    value: "TDAH",
    label: "TDAH - Déficit de Atenção e Hiperatividade",
    descricao: "Dificuldade de foco sustentado, inquietação ou impulsividade",
  },
  {
    value: "Dislexia",
    label: "Dislexia",
    descricao: "Dificuldade no processamento e decodificação da leitura e escrita",
  },
  {
    value: "Ansiedade Generalizada",
    label: "Ansiedade Generalizada (TAG)",
    descricao: "Preocupação frequente e suscetibilidade a crises em situações de estresse",
  },
  {
    value: "TOC",
    label: "TOC - Transtorno Obsessivo-Compulsivo",
    descricao: "Pensamentos intrusivos recorrentes e comportamentos repetitivos ou rituais",
  },
  {
    value: "Discalculia",
    label: "Discalculia",
    descricao: "Dificuldade específica na compreensão e manipulação de números e cálculos",
  },
  {
    value: "Outro",
    label: "Outro transtorno ou condição",
    descricao: "Marque para especificar outro diagnóstico ou necessidade neurodivergente",
  },
];

export default function AlunoDashboard() {
  const { user } = useAuth();
  const [form, setForm] = useState<CadastroNeurodivergente>({
    condicao: "",
    descricao: "",
    necessidades: "",
    contato_emergencia: "",
  });
  const [selectedTranstornos, setSelectedTranstornos] = useState<string[]>([]);
  const [outroTranstorno, setOutroTranstorno] = useState("");
  const [jaCadastrado, setJaCadastrado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    const carregarPerfil = async () => {
      try {
        const perfil = await apiService.getPerfilAluno();
        if (perfil.cadastro_neurodivergente) {
          const cad = perfil.cadastro_neurodivergente;
          setForm(cad);
          setJaCadastrado(true);

          // Extrair transtornos/condições previamente salvas na string condicao
          let lista: string[] = [];
          if (cad.condicao) {
            lista = cad.condicao.split(",").map((s) => s.trim()).filter(Boolean);
          }

          // Verifica se algum item da lista tem o formato "Outro (...)"
          const outroMatch = lista.find((item) => item.startsWith("Outro (") && item.endsWith(")"));
          if (outroMatch) {
            const especificado = outroMatch.slice(7, -1);
            setOutroTranstorno(especificado);
            lista = lista.map((item) => (item === outroMatch ? "Outro" : item));
          } else {
            // Verifica itens fora das opções pré-definidas
            const opcoesValores = OPCOES_TRANSTORNOS.map((o) => o.value);
            const itensDesconhecidos = lista.filter((item) => !opcoesValores.includes(item));
            if (itensDesconhecidos.length > 0) {
              setOutroTranstorno(itensDesconhecidos.join(", "));
              lista = lista.filter((item) => opcoesValores.includes(item));
              if (!lista.includes("Outro")) {
                lista.push("Outro");
              }
            }
          }

          setSelectedTranstornos(lista);
        }
      } catch {
        // Backend indisponível ou sem cadastro
      }
    };
    carregarPerfil();
  }, []);

  const toggleTranstorno = (value: string) => {
    setSelectedTranstornos((prev) => {
      const existe = prev.includes(value);
      if (existe) {
        if (value === "Outro") setOutroTranstorno("");
        return prev.filter((item) => item !== value);
      } else {
        return [...prev, value];
      }
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (selectedTranstornos.length === 0) {
      setFeedback({
        type: "error",
        msg: "Por favor, selecione pelo menos um transtorno ou condição.",
      });
      return;
    }

    if (selectedTranstornos.includes("Outro") && !outroTranstorno.trim()) {
      setFeedback({
        type: "error",
        msg: "Por favor, especifique o outro transtorno no campo indicado.",
      });
      return;
    }

    setLoading(true);
    setFeedback(null);

    // Constrói lista formatada com as opções selecionadas
    const listaFormatada = selectedTranstornos.map((item) =>
      item === "Outro" && outroTranstorno.trim() ? `Outro (${outroTranstorno.trim()})` : item
    );

    // Envia estritamente os campos existentes de CadastroNeurodivergente
    const dadosAtualizados: CadastroNeurodivergente = {
      condicao: listaFormatada.join(", "),
      descricao: form.descricao,
      necessidades: form.necessidades,
      contato_emergencia: form.contato_emergencia,
    };

    try {
      await apiService.cadastrarNeurodivergente(dadosAtualizados);
      setForm(dadosAtualizados);
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
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-sm font-medium px-3 py-1.5 rounded-full">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Cadastro já realizado
              </div>
              {form.condicao && (
                <span className="text-xs text-gray-500">
                  Transtorno(s) atual(is): <strong className="text-gray-700">{form.condicao}</strong>
                </span>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Múltipla Escolha de Transtornos */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-gray-700">
                Transtornos e Neurodivergências <span className="text-red-500">*</span>
              </label>
              {selectedTranstornos.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {selectedTranstornos.length} {selectedTranstornos.length === 1 ? "selecionado" : "selecionados"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTranstornos([]);
                      setOutroTranstorno("");
                    }}
                    className="text-xs text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                  >
                    Limpar
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Selecione uma ou mais opções abaixo que se aplicam a você (múltipla escolha):
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {OPCOES_TRANSTORNOS.map((opcao) => {
                const isSelected = selectedTranstornos.includes(opcao.value);
                return (
                  <label
                    key={opcao.value}
                    className={`relative flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none text-left ${
                      isSelected
                        ? "border-emerald-600 bg-emerald-50/70 shadow-xs ring-2 ring-emerald-500/20"
                        : "border-gray-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/20"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="transtornos"
                      value={opcao.value}
                      checked={isSelected}
                      onChange={() => toggleTranstorno(opcao.value)}
                      className="sr-only"
                    />
                    <div
                      className={`w-5 h-5 mt-0.5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : "border-gray-300 bg-white"
                      }`}
                      aria-hidden="true"
                    >
                      {isSelected && (
                        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className={`text-sm font-semibold ${isSelected ? "text-emerald-950" : "text-gray-900"}`}>
                        {opcao.label}
                      </div>
                      <p className={`text-xs mt-0.5 leading-relaxed ${isSelected ? "text-emerald-700" : "text-gray-500"}`}>
                        {opcao.descricao}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Campo para especificar quando 'Outro' estiver marcado */}
            {selectedTranstornos.includes("Outro") && (
              <div className="mt-3 p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-1.5">
                <label htmlFor="outro_transtorno" className="block text-xs font-semibold text-emerald-900">
                  Especifique o outro transtorno ou condição: <span className="text-red-500">*</span>
                </label>
                <input
                  id="outro_transtorno"
                  type="text"
                  value={outroTranstorno}
                  onChange={(e) => setOutroTranstorno(e.target.value)}
                  placeholder="Ex.: Síndrome de Tourette, Transtorno Bipolar, etc."
                  required
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-sm bg-white"
                />
              </div>
            )}
          </div>

          <div>
            <label htmlFor="descricao" className="block text-sm font-semibold text-gray-700 mb-1.5">
              Descrição
            </label>
            <textarea
              id="descricao"
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              placeholder="Descreva seus transtornos e como eles se manifestam no dia a dia acadêmico..."
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
