
import type { Timestamp } from 'firebase/firestore';
import { z } from 'genkit';

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


export interface PauseLog {
  id?: string;
  agentName: string;
  pauseStartTime: string; // ISO string
  pauseEndTime: string; // ISO string
}

export interface AgentDocument extends Omit<Agent, 'lastInteractionTime' | 'pauseStartTime'> {
    lastInteractionTime: Timestamp;
    pauseStartTime?: Timestamp;
}

export interface PauseLogDocument extends Omit<PauseLog, 'pauseStartTime' | 'pauseEndTime'> {
    pauseStartTime: Timestamp;
    pauseEndTime: Timestamp;
}
