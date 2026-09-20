/**
 * StudentCare - Camada de serviço API REST
 * Comunicação com backend FastAPI
 */

import { mockApiService } from "./mockApi";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export interface UserData {
  id: string;
  nome: string;
  email: string;
  role: "aluno" | "professor" | "coacessi" | "admin";
}

export interface LoginResponse {
  token: string;
  user: UserData;
}

export interface CadastroNeurodivergente {
  condicao: string;
  descricao: string;
  necessidades: string;
  contato_emergencia: string;
}

export interface PerfilAluno {
  id: string;
  nome: string;
  email: string;
  cadastro_neurodivergente?: CadastroNeurodivergente;
  data_cadastro?: string;
}

export interface ChamadoAuxilio {
  sala: string;
  tipo: string;
  descricao: string;
}

export type StatusAlerta = "novo" | "em_analise" | "suporte_em_progresso" | "resolvido" | "descartado";

export type PrioridadeAlerta = "baixa" | "media" | "alta";

export interface Profissional {
  id: string;
  nome: string;
}

export interface Intervencao {
  id: string;
  timestamp: string;
  profissional: Profissional;
  descricao: string;
}

export interface Alerta {
  id: string;
  timestamp: string;
  sala: string;
  /** Indicador comportamental observado — não é um diagnóstico nem uma crise confirmada. */
  indicador_comportamental: string;
  status: StatusAlerta;
  /** Prioridade avaliada para triagem; independente da confiança do modelo e ajustável pela equipe. */
  prioridade: PrioridadeAlerta;
  confianca: number;
  profissional_atribuido?: Profissional;
  historico_intervencoes: Intervencao[];
  aluno_info?: {
    nome: string;
    condicao: string;
    comunicacao_preferida?: string;
    diretrizes_apoio?: string;
    contato_emergencia?: string;
  };
  snapshot_url?: string;
}

export interface Estatisticas {
  total_alertas_hoje: number;
  falsos_alarmes: number;
  crises_confirmadas: number;
  em_analise: number;
  em_atendimento: number;
}

export interface Notificacao {
  id: string;
  mensagem: string;
  tipo: "alerta" | "info" | "sucesso";
  timestamp: string;
  lida: boolean;
}

export interface Sala {
  id: string;
  nome: string;
  bloco?: string;
  capacidade?: number;
  camera_url?: string;
  status: "ativo" | "inativo" | "manutencao";
  descricao?: string;
}

export interface NovaSala {
  nome: string;
  bloco?: string;
  capacidade?: number;
  camera_url?: string;
  status: "ativo" | "inativo" | "manutencao";
  descricao?: string;
}

class ApiService {
  private baseUrl: string;
  // O token e sessão são mantidos em memória. O backend FastAPI gerencia autenticação (Cookies HttpOnly ou Bearer Token).
  private token: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  getToken(): string | null {
    return this.token;
  }

  setToken(token: string): void {
    this.token = token;
  }

  clearToken(): void {
    this.token = null;
  }

  private async request<T>(
    endpoint: string,
    method: string = "GET",
    body?: unknown
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // credentials: "include" permite que FastAPI utilize cookies HTTP-Only de sessão/JWT nativamente
    const config: RequestInit = {
      method,
      headers,
      credentials: "include",
    };

    if (body && method !== "GET") {
      config.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Erro na requisição: ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async login(email: string, senha: string): Promise<LoginResponse> {
    const data = await this.request<LoginResponse>("/auth/login", "POST", { email, senha });
    this.setToken(data.token);
    return data;
  }

  // Aluno
  async getPerfilAluno(): Promise<PerfilAluno> {
    return this.request<PerfilAluno>("/aluno/perfil");
  }

  async cadastrarNeurodivergente(dados: CadastroNeurodivergente): Promise<{ message: string }> {
    return this.request("/aluno/cadastro-neurodivergente", "POST", dados);
  }

  // Professor
  async getCameraStream(salaId: string): Promise<{ stream_url: string }> {
    return this.request(`/professor/camera/${salaId}`);
  }

  async chamarAuxilio(dados: ChamadoAuxilio): Promise<{ message: string; chamado_id: string }> {
    return this.request("/professor/chamar-auxilio", "POST", dados);
  }

  // COACESSI
  async getAlertas(): Promise<Alerta[]> {
    return this.request<Alerta[]>("/coacessi/alertas");
  }

  async getAlertaDetalhes(alertaId: string): Promise<Alerta> {
    return this.request<Alerta>(`/coacessi/alertas/${alertaId}`);
  }

  /** Auto-atribuição ("assumir alerta"): o profissional responsável é sempre o usuário autenticado, nunca informado pelo cliente. */
  async atribuirAlerta(alertaId: string): Promise<{ message: string; profissional: Profissional }> {
    return this.request(`/coacessi/alertas/${alertaId}/atribuir`, "PATCH");
  }

  async atualizarStatusAlerta(alertaId: string, status: StatusAlerta): Promise<{ message: string }> {
    return this.request(`/coacessi/alertas/${alertaId}/status`, "PATCH", { status });
  }

  async atualizarPrioridadeAlerta(alertaId: string, prioridade: PrioridadeAlerta): Promise<{ message: string }> {
    return this.request(`/coacessi/alertas/${alertaId}/prioridade`, "PATCH", { prioridade });
  }

  async registrarIntervencao(alertaId: string, descricao: string): Promise<{ message: string; intervencao: Intervencao }> {
    return this.request(`/coacessi/alertas/${alertaId}/intervencoes`, "POST", { descricao });
  }

  async getEstatisticas(): Promise<Estatisticas> {
    return this.request<Estatisticas>("/coacessi/estatisticas");
  }

  // Notificações
  async getNotificacoes(): Promise<Notificacao[]> {
    return this.request<Notificacao[]>("/notificacoes");
  }

  async marcarNotificacaoLida(id: string): Promise<{ message: string }> {
    return this.request(`/notificacoes/${id}/lida`, "PUT");
  }

  // ==================== ADMIN TI - GESTÃO DE SALAS ====================

  async getSalas(): Promise<Sala[]> {
    return this.request<Sala[]>("/admin/salas");
  }

  async cadastrarSala(dados: NovaSala): Promise<{ message: string; sala: Sala }> {
    return this.request("/admin/salas", "POST", dados);
  }

  async atualizarSala(id: string, dados: Partial<NovaSala>): Promise<{ message: string; sala: Sala }> {
    return this.request(`/admin/salas/${id}`, "PUT", dados);
  }

  async removerSala(id: string): Promise<{ message: string }> {
    return this.request(`/admin/salas/${id}`, "DELETE");
  }
}

/**
 * Seleciona automaticamente a implementação:
 * - Mock (padrão em dev): dados fictícios para testar todas as páginas
 * - Real: conecta ao backend FastAPI
 *
 * Para desativar o mock, crie um arquivo .env.local com:
 *   NEXT_PUBLIC_USE_MOCK=false
 *
 * Credenciais de teste (com mock):
 *   aluno@teste.com     / 123456
 *   professor@teste.com / 123456
 *   coacessi@teste.com  / 123456
 */
const useMock = process.env.NEXT_PUBLIC_USE_MOCK !== "false";

export const apiService: ApiService = useMock
  ? (mockApiService as unknown as ApiService)
  : new ApiService();
