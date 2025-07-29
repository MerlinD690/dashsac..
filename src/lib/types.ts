import { z } from 'zod';

// --- ESTRUTURAS DO BANCO DE DADOS (FIRESTORE) ---

// Representa um atendente no nosso sistema. Usado no front-end.
export interface Agent {
  id: string; // O ID do documento no Firestore
  name: string;
  tomticketName?: string; // Nome correspondente no sistema TomTicket
  lastInteractionTime: string; // ISO string
  activeClients: number;
  isAvailable: boolean;
  totalClientsHandled: number;
  avgTimePerClient: number; // in minutes
  isOnPause: boolean;
  pauseStartTime?: string; // ISO string
}

// Como os dados do atendente são armazenados no Firestore.
export interface AgentDocument {
  name: string;
  tomticketName?: string;
  lastInteractionTime: string;
  activeClients: number;
  isAvailable: boolean;
  totalClientsHandled: number;
  avgTimePerClient: number;
  isOnPause: boolean;
  pauseStartTime?: string;
}

// Representa um log de pausa no nosso sistema.
export interface PauseLog {
  id: string; // O ID do documento no Firestore
  agentName: string;
  pauseStartTime: string; // ISO string
  pauseEndTime: string; // ISO string
}

// Como os dados do log de pausa são armazenados no Firestore.
export interface PauseLogDocument {
    agentName: string;
    pauseStartTime: string;
    pauseEndTime: string;
}


// --- ESTRUTURAS DA API TOMTICKET (BASEADO NO POSTMAN E DOCUMENTAÇÃO) ---

// Representa a resposta da API para a consulta de chats (/chat/list)
export interface TomTicketApiResponse {
  success: boolean;
  data: TomTicketChat[];
  pagination: {
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
  };
}

// Representa um único chat na resposta da API
export interface TomTicketChat {
  id: number;
  protocol: string;
  situation: string;
  customer: {
    id: number;
    name: string;
    email: string | null;
  };
  operator: {
    id: number;
    name: string;
  } | null; // O operador pode ser nulo se o chat não estiver atribuído
  department: {
    id: number;
    name: string;
  };
  unread_messages: number;
  last_update: string; // Ex: "2024-07-31 15:30:00"
  initial_date: string; // Ex: "2024-07-31 15:25:00"
}


// --- ESTRUTURAS PARA ANÁLISE DE IA ---

export const AgentPerformanceSchema = z.object({
    name: z.string().describe('Nome do atendente.'),
    clientsHandled: z.number().describe('Total de clientes atendidos.'),
    totalPauseTime: z.string().describe('Tempo total de pausa formatado (ex: "X minutos" ou "Y segundos").'),
});

const AgentIdentifierSchema = z.object({
    name: z.string(),
    clientsHandled: z.number(),
});

export const AnalysisOutputSchema = z.object({
  mostProductiveAgent: AgentIdentifierSchema.describe('A atendente que atendeu o maior número de clientes no dia.'),
  leastProductiveAgent: AgentIdentifierSchema.describe('A atendente que atendeu o menor número de clientes no dia.'),
  agentPerformance: z
    .array(AgentPerformanceSchema)
    .describe('Lista de performance individual de cada atendente para o dia.'),
  overallSummary: z
    .string()
    .describe(
      'Um resumo em um ou dois parágrafos sobre a performance geral do dia, incluindo dicas e recomendações.'
    ),
  historicalAnalysis: z.string().optional().describe("Uma análise de tendências de performance baseada nos dados históricos."),
});
export type AnalysisOutput = z.infer<typeof AnalysisOutputSchema>;


export interface DailyReport extends AnalysisOutput {
    date: string; // YYYY-MM-DD
}

export interface AgentWithPauseData {
  name: string;
  totalClientsHandled: number;
  totalPauseTimeFormatted: string;
}

export const AgentWithPauseDataSchema = z.object({
  name: z.string(),
  totalClientsHandled: z.number(),
  totalPauseTimeFormatted: z.string(),
});


export const AnalysisInputSchema = z.object({
  agents: z.array(AgentWithPauseDataSchema),
  totalClientsToday: z.number().describe('O número total de clientes atendidos por todos os atendentes no dia.'),
  historicalData: z.array(z.any()).optional().describe('Dados de performance dos dias anteriores para análise de tendências.'),
});
export type AnalysisInput = z.infer<typeof AnalysisInputSchema>;
