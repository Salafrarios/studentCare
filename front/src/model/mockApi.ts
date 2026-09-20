/**
 * StudentCare - Mock API Service
 * Simula o backend FastAPI para testes do frontend.
 *
 * Usuários de teste:
 *   aluno@teste.com     / 123456  → Dashboard do Aluno
 *   professor@teste.com / 123456  → Dashboard do Professor
 *   coacessi@teste.com  / 123456  → Dashboard da COACESSI
 */

import {
  LoginResponse,
  PerfilAluno,
  CadastroNeurodivergente,
  ChamadoAuxilio,
  Alerta,
  ResolucaoAlerta,
  Estatisticas,
  Notificacao,
} from "./api";

/** Simula latência de rede */
const delay = (ms: number = 600) => new Promise((r) => setTimeout(r, ms));

/** Banco de dados em memória */
let cadastroAluno: CadastroNeurodivergente | null = null;

const alertasMock: Alerta[] = [
  {
    id: "alerta-001",
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
    sala: "Sala 101",
    tipo_crise: "Meltdown",
    status: "novo",
    confianca: 0.92,
    aluno_info: {
      nome: "Maria Silva",
      condicao: "TEA",
      contato_emergencia: "(81) 99999-1234",
    },
    snapshot_url: undefined,
  },
  {
    id: "alerta-002",
    timestamp: new Date(Date.now() - 18 * 60000).toISOString(),
    sala: "Lab. Informática 1",
    tipo_crise: "Crise de Ansiedade",
    status: "em_analise",
    confianca: 0.78,
    aluno_info: {
      nome: "João Oliveira",
      condicao: "Ansiedade Generalizada",
      contato_emergencia: "(81) 98888-5678",
    },
  },
  {
    id: "alerta-003",
    timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
    sala: "Sala 202",
    tipo_crise: "Crise de Pânico",
    status: "novo",
    confianca: 0.85,
  },
  {
    id: "alerta-004",
    timestamp: new Date(Date.now() - 120 * 60000).toISOString(),
    sala: "Auditório",
    tipo_crise: "Meltdown",
    status: "resolvido",
    confianca: 0.41,
  },
];

const notificacoesMock: Notificacao[] = [
  {
    id: "notif-001",
    mensagem: "Novo alerta detectado na Sala 101 — possível meltdown",
    tipo: "alerta",
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
    lida: false,
  },
  {
    id: "notif-002",
    mensagem: "Crise de ansiedade detectada no Lab. Informática 1",
    tipo: "alerta",
    timestamp: new Date(Date.now() - 18 * 60000).toISOString(),
    lida: false,
  },
  {
    id: "notif-003",
    mensagem: "Chamado de auxílio enviado com sucesso para a Sala 103",
    tipo: "sucesso",
    timestamp: new Date(Date.now() - 60 * 60000).toISOString(),
    lida: true,
  },
];

/** Mock do serviço de API */
class MockApiService {
  private token: string | null = null;

  getToken(): string | null {
    return this.token;
  }

  setToken(token: string): void {
    this.token = token;
  }

  clearToken(): void {
    this.token = null;
  }

  // ==================== AUTH ====================

  async login(email: string, senha: string): Promise<LoginResponse> {
    await delay(800);

    const usuarios: Record<string, LoginResponse> = {
      "aluno@teste.com": {
        token: "mock-token-aluno-xyz",
        user: { id: "usr-001", nome: "Wilian de Lima Santos", email: "aluno@teste.com", role: "aluno" },
      },
      "professor@teste.com": {
        token: "mock-token-professor-xyz",
        user: { id: "usr-002", nome: "Prof. João da Silva", email: "professor@teste.com", role: "professor" },
      },
      "coacessi@teste.com": {
        token: "mock-token-coacessi-xyz",
        user: { id: "usr-003", nome: "Carla Rodrigues", email: "coacessi@teste.com", role: "coacessi" },
      },
    };

    const found = usuarios[email.toLowerCase()];

    if (!found || senha !== "123456") {
      throw new Error("E-mail ou senha inválidos. Use os e-mails de teste (veja console).");
    }

    console.log(
      `%c✅ Login mock: ${found.user.nome} (${found.user.role})`,
      "color: #2D6A4F; font-weight: bold; font-size: 14px;"
    );

    this.setToken(found.token);
    return found;
  }

  // ==================== ALUNO ====================

  async getPerfilAluno(): Promise<PerfilAluno> {
    await delay();
    return {
      id: "usr-001",
      nome: "Wilian de Lima Santos",
      email: "aluno@teste.com",
      cadastro_neurodivergente: cadastroAluno || undefined,
      data_cadastro: cadastroAluno ? new Date().toISOString() : undefined,
    };
  }

  async cadastrarNeurodivergente(dados: CadastroNeurodivergente): Promise<{ message: string }> {
    await delay(1000);
    cadastroAluno = { ...dados };
    console.log("%c📋 Cadastro neurodivergente salvo:", "color: #2D6A4F; font-weight: bold;", dados);
    return { message: "Cadastro realizado com sucesso!" };
  }

  // ==================== PROFESSOR ====================

  async getCameraStream(salaId: string): Promise<{ stream_url: string }> {
    await delay(1200);
    // Retorna uma URL placeholder — em produção será o stream real
    console.log(`%c📹 Stream solicitado: ${salaId}`, "color: #40916C; font-weight: bold;");
    return { stream_url: "" }; // Vazio para mostrar o placeholder de "câmera indisponível"
  }

  async chamarAuxilio(dados: ChamadoAuxilio): Promise<{ message: string; chamado_id: string }> {
    await delay(1000);
    const chamadoId = `chamado-${Date.now()}`;
    console.log(
      `%c🚨 CHAMADO DE AUXÍLIO ENVIADO!`,
      "color: #E63946; font-weight: bold; font-size: 16px;",
      "\n", dados, "\nID:", chamadoId
    );
    return { message: "Chamado enviado com sucesso!", chamado_id: chamadoId };
  }

  // ==================== COACESSI ====================

  async getAlertas(): Promise<Alerta[]> {
    await delay(400);
    return [...alertasMock];
  }

  async getAlertaDetalhes(alertaId: string): Promise<Alerta> {
    await delay();
    const alerta = alertasMock.find((a) => a.id === alertaId);
    if (!alerta) throw new Error("Alerta não encontrado");
    return { ...alerta };
  }

  async resolverAlerta(alertaId: string, resolucao: ResolucaoAlerta): Promise<{ message: string }> {
    await delay(800);
    const idx = alertasMock.findIndex((a) => a.id === alertaId);
    if (idx >= 0) {
      alertasMock[idx].status = "resolvido";
    }
    console.log(
      `%c✅ Alerta ${alertaId} resolvido:`,
      "color: #2D6A4F; font-weight: bold;",
      resolucao
    );
    return { message: "Análise salva com sucesso!" };
  }

  async getEstatisticas(): Promise<Estatisticas> {
    await delay(300);
    const resolvidos = alertasMock.filter((a) => a.status === "resolvido").length;
    return {
      total_alertas_hoje: alertasMock.length,
      crises_confirmadas: Math.max(1, resolvidos),
      falsos_alarmes: 1,
      em_analise: alertasMock.filter((a) => a.status === "em_analise").length,
    };
  }

  // ==================== NOTIFICAÇÕES ====================

  async getNotificacoes(): Promise<Notificacao[]> {
    await delay(300);
    return [...notificacoesMock];
  }

  async marcarNotificacaoLida(id: string): Promise<{ message: string }> {
    await delay(200);
    const notif = notificacoesMock.find((n) => n.id === id);
    if (notif) notif.lida = true;
    return { message: "Notificação marcada como lida" };
  }
}

export const mockApiService = new MockApiService();
