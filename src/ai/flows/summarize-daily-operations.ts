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
  summary: z.string().describe('A summary of the day\'s operations, including key metrics and unusual events.'),
});

export type SummarizeDailyOperationsOutput = z.infer<typeof SummarizeDailyOperationsOutputSchema>;

export async function summarizeDailyOperations(input: SummarizeDailyOperationsInput): Promise<SummarizeDailyOperationsOutput> {
  return summarizeDailyOperationsFlow(input);
}

const summarizeDailyOperationsPrompt = ai.definePrompt({
  name: 'summarizeDailyOperationsPrompt',
  input: {schema: SummarizeDailyOperationsInputSchema},
  output: {schema: SummarizeDailyOperationsOutputSchema},
  prompt: `You are a laundry manager providing a summary of the day's operations.

  Provide a concise overview of the day's activities, including:
  - Total number of clients served.
  - Total pause time for all agents.
  - Identification of any unusual events or significant deviations from the norm.

  Analyze the following data to create the summary:

  Agents Data:
  {{#each agentsData}}
  - Name: {{name}}, Clients Handled: {{totalClientsHandled}}, Active Clients: {{activeClients}}, On Pause: {{isOnPause}}
  {{/each}}

  Pause Logs:
  {{#each pauseLogs}}
  - Agent: {{agentName}}, Start Time: {{pauseStartTime}}, End Time: {{pauseEndTime}}
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
