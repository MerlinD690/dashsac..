// Summarize the day's laundry operations, providing key metrics and identifying unusual events.

'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeDailyOperationsInputSchema = z.object({
  agentsData: z.array(
    z.object({
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
    })
  ).describe('Data for all agents, including their status and performance metrics.'),
  pauseLogs: z.array(
    z.object({
      agentName: z.string(),
      pauseStartTime: z.string(),
      pauseEndTime: z.string(),
    })
  ).describe('Logs of all pause events for each agent.'),
});

export type SummarizeDailyOperationsInput = z.infer<typeof SummarizeDailyOperationsInputSchema>;

const SummarizeDailyOperationsOutputSchema = z.object({
  summary: z.string().describe('Um resumo das operações do dia, incluindo as principais métricas e eventos incomuns.'),
});

export type SummarizeDailyOperationsOutput = z.infer<typeof SummarizeDailyOperationsOutputSchema>;

export async function summarizeDailyOperations(input: SummarizeDailyOperationsInput): Promise<SummarizeDailyOperationsOutput> {
  return summarizeDailyOperationsFlow(input);
}

const summarizeDailyOperationsPrompt = ai.definePrompt({
  name: 'summarizeDailyOperationsPrompt',
  input: {schema: SummarizeDailyOperationsInputSchema},
  output: {schema: SummarizeDailyOperationsOutputSchema},
  prompt: `Você é um gerente de lavanderia fornecendo um resumo das operações do dia.

  Forneça uma visão geral concisa das atividades do dia, incluindo:
  - Número total de clientes atendidos.
  - Tempo total de pausa para todos os atendentes.
  - Identificação de quaisquer eventos incomuns ou desvios significativos da norma.

  Analise os seguintes dados para criar o resumo:

  Dados dos Atendentes:
  {{#each agentsData}}
  - Nome: {{name}}, Clientes Atendidos: {{totalClientsHandled}}, Clientes Ativos: {{activeClients}}, Em Pausa: {{isOnPause}}
  {{/each}}

  Registros de Pausa:
  {{#each pauseLogs}}
  - Atendente: {{agentName}}, Início: {{pauseStartTime}}, Fim: {{pauseEndTime}}
  {{/each}}
  `,
});

const summarizeDailyOperationsFlow = ai.defineFlow(
  {
    name: 'summarizeDailyOperationsFlow',
    inputSchema: SummarizeDailyOperationsInputSchema,
    outputSchema: SummarizeDailyOperationsOutputSchema,
  },
  async input => {
    const {output} = await summarizeDailyOperationsPrompt(input);
    return output!;
  }
);
