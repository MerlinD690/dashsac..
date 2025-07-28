
import type { Timestamp } from 'firebase/firestore';
import { z } from 'zod';

export interface Agent {
  id: string;
  name: string;
  lastInteractionTime: string; // ISO string for client-side consistency
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
  lastInteractionTime: z.string(),
  activeClients: z.number(),
  isAvailable: z.boolean(),
  totalClientsHandled: z.number(),
  avgTimePerClient: z.number(),
  clientFeedback: z.string().optional(),
  isOnPause: z.boolean(),
  pauseStartTime: z.string().optional(),
});

// This type is used when passing data to the AI, it includes the pre-calculated pause time.
export interface AgentWithPauseData extends Agent {
  totalPauseTimeFormatted: string;
}

export const AgentWithPauseDataSchema = AgentSchema.extend({
  totalPauseTimeFormatted: z.string(),
});


export interface PauseLog {
  id?: string;
  agentName: string;
  pauseStartTime: string; // ISO string
  pauseEndTime: string; // ISO string
}

export const PauseLogSchema = z.object({
    id: z.string().optional(),
    agentName: z.string(),
    pauseStartTime: z.string(),
    pauseEndTime: z.string(),
});


export interface AgentDocument extends Omit<Agent, 'lastInteractionTime' | 'pauseStartTime'> {
    lastInteractionTime: Timestamp;
    pauseStartTime?: Timestamp;
}

export interface PauseLogDocument extends Omit<PauseLog, 'pauseStartTime' | 'pauseEndTime'> {
    pauseStartTime: Timestamp;
    pauseEndTime: Timestamp;
}


// AI Related types
export const AnalysisInputSchema = z.object({
  agents: z.array(AgentWithPauseDataSchema),
});
export type AnalysisInput = z.infer<typeof AnalysisInputSchema>;


const AgentPerformanceSchema = z.object({
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
});
export type AnalysisOutput = z.infer<typeof AnalysisOutputSchema>;
