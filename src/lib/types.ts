import { z } from 'zod';

// Estrutura principal do Atendente, usada no front-end
export interface Agent {
  id: string; // O ID do documento no Firestore
  name: string;
  tomticketName?: string; // Nome usado no sistema TomTicket
  lastInteractionTime: string; // ISO string
  activeClients: number;
  isAvailable: boolean;
  totalClientsHandled: number;
  avgTimePerClient: number; // in minutes
  clientFeedback?: string;
  isOnPause: boolean;
  pauseStartTime?: string; // ISO string
}

// Como os dados do atendente são armazenados no Firestore (sem o ID no corpo do doc)
export interface AgentDocument {
  name: string;
  tomticketName?: string; // Nome usado no sistema TomTicket
  lastInteractionTime: string;
  activeClients: number;
  isAvailable: boolean;
  totalClientsHandled: number;
  avgTimePerClient: number;
  isOnPause: boolean;
  pauseStartTime?: string;
}

// Log de Pausa, usado no front-end
export interface PauseLog {
  id: string; // O ID do documento no Firestore
  agentName: string;
  pauseStartTime: string; // ISO string
  pauseEndTime: string; // ISO string
}

// Como os dados do log de pausa são armazenados no Firestore
export interface PauseLogDocument {
    agentName: string;
    pauseStartTime: string;
    pauseEndTime: string;
}


// Tipos relacionados à IA (permanecem os mesmos)
export const AgentPerformanceSchema = z.object({
    name: z.string().describe('Nome do atendente.'),
    clientsHandled: z.number().describe('Total de clientes atendidos.'),
    totalPauseTime: z.string().describe('Tempo total de pausa formatado (ex: "X minutos" ou "Y segundos"). Este valor já vem calculado.'),
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
      'Um resumo em um ou dois parágrafos sobre a performance geral do dia, incluindo dicas e recomendações sobre pausas, número de atendimentos e eficiência.'
    ),
  historicalAnalysis: z.string().optional().describe("Uma análise de tendências de performance baseada nos dados históricos. Inclui insights sobre consistência (quem se destaca positiva ou negativamente ao longo do tempo), possível sobrecarga de trabalho e recomendações estratégicas. Sempre use os números e dados para embasar sua análise."),
});
export type AnalysisOutput = z.infer<typeof AnalysisOutputSchema>;


export interface DailyReport extends AnalysisOutput {
    date: string; // YYYY-MM-DD
}

// Este tipo é usado quando passamos os dados para a IA, incluindo o tempo de pausa pré-calculado
export interface AgentWithPauseData extends Agent {
  totalPauseTimeFormatted: string;
}

export const AgentWithPauseDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  tomticketName: z.string().optional(),
  lastInteractionTime: z.string(),
  activeClients: z.number(),
  isAvailable: z.boolean(),
  totalClientsHandled: z.number(),
  avgTimePerClient: z.number(),
  isOnPause: z.boolean(),
  pauseStartTime: z.string().optional(),
  totalPauseTimeFormatted: z.string(),
});


export const AnalysisInputSchema = z.object({
  agents: z.array(AgentWithPauseDataSchema),
  totalClientsToday: z.number().describe('O número total de clientes atendidos por todos os atendentes no dia.'),
  historicalData: z.array(z.any()).optional().describe('Dados de performance dos dias anteriores para análise de tendências.'),
});
export type AnalysisInput = z.infer<typeof AnalysisInputSchema>;
