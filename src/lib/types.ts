import { z } from 'zod';

export interface Agent {
  id: string;
  name: string;
  lastInteractionTime: string; // ISO string
  activeClients: number;
  isAvailable: boolean;
  totalClientsHandled: number;
  avgTimePerClient: number; // in minutes
  clientFeedback?: string;
  isOnPause: boolean;
  pauseStartTime?: string; // ISO string
}

export const AgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  lastInteractionTime: z.string().datetime(),
  activeClients: z.number().int(),
  isAvailable: z.boolean(),
  totalClientsHandled: z.number().int(),
  avgTimePerClient: z.number(),
  clientFeedback: z.string().optional(),
  isOnPause: z.boolean(),
  pauseStartTime: z.string().datetime().optional().nullable(),
});

// This type is used when passing data to the AI, it includes the pre-calculated pause time.
export interface AgentWithPauseData extends Agent {
  totalPauseTimeFormatted: string;
}

export const AgentWithPauseDataSchema = AgentSchema.extend({
  totalPauseTimeFormatted: z.string(),
});


export interface PauseLog {
  id?: number; // Supabase uses number for primary key by default
  agentName: string;
  pauseStartTime: string; // ISO string
  pauseEndTime: string; // ISO string
}

export const PauseLogSchema = z.object({
    id: z.number().int().optional(),
    agentName: z.string(),
    pauseStartTime: z.string().datetime(),
    pauseEndTime: z.string().datetime(),
});

// AI Related types
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
  mostProductiveAgent: AgentIdentifierSchema.describe('O atendente que atendeu o maior número de clientes.'),
  leastProductiveAgent: AgentIdentifierSchema.describe('O atendente que atendeu o menor número de clientes.'),
  agentPerformance: z
    .array(AgentPerformanceSchema)
    .describe('Lista de performance individual de cada atendente.'),
  overallSummary: z
    .string()
    .describe(
      'Um resumo em um ou dois parágrafos sobre a performance geral do dia, incluindo dicas e recomendações sobre pausas, número de atendimentos e eficiência.'
    ),
  historicalAnalysis: z.string().optional().describe("Uma análise de tendências de performance baseada nos dados históricos. Inclui insights sobre consistência, atendentes que mais se destacam (positiva ou negativamente) ao longo do tempo e recomendações estratégicas. Sempre use os números e dados para embasar sua análise."),
});
export type AnalysisOutput = z.infer<typeof AnalysisOutputSchema>;


export interface DailyReport extends AnalysisOutput {
    date: string; // YYYY-MM-DD
}

export const DailyReportSchema = AnalysisOutputSchema.extend({
    date: z.string(),
});


export const AnalysisInputSchema = z.object({
  agents: z.array(AgentWithPauseDataSchema),
  totalClientsToday: z.number().describe('O número total de clientes atendidos por todos os atendentes no dia.'),
  historicalData: z.array(DailyReportSchema).optional().describe('Dados de performance dos dias anteriores para análise de tendências.'),
});
export type AnalysisInput = z.infer<typeof AnalysisInputSchema>;

// Supabase doesn't need these document types anymore
export interface AgentDocument {}
export interface PauseLogDocument {}
