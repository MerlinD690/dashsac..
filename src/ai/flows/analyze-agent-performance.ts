
'use server';

/**
 * @fileOverview AI flow for analyzing agent performance in a laundry service.
 *
 * - analyzeAgentPerformance - Analyzes performance metrics of laundry agents and provides insights.
 * - AnalyzeAgentPerformanceInput - Input type for the analyzeAgentPerformance function.
 * - AnalyzeAgentPerformanceOutput - Return type for the analyzeAgentPerformance function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { AgentSchema } from '@/lib/types';

const AnalyzeAgentPerformanceInputSchema = z.object({
  agents: z
    .array(AgentSchema)
    .describe('The list of agents and their performance metrics.'),
  query: z.string().describe('The query from the user regarding agent performance.'),
});
export type AnalyzeAgentPerformanceInput = z.infer<
  typeof AnalyzeAgentPerformanceInputSchema
>;

const AnalyzeAgentPerformanceOutputSchema = z.string().describe('The analysis of agent performance and suggestions.');
export type AnalyzeAgentPerformanceOutput = z.infer<
  typeof AnalyzeAgentPerformanceOutputSchema
>;

export async function analyzeAgentPerformance(
  input: AnalyzeAgentPerformanceInput
): Promise<AnalyzeAgentPerformanceOutput> {
  return analyzeAgentPerformanceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeAgentPerformancePrompt',
  input: {
    schema: AnalyzeAgentPerformanceInputSchema,
  },
  output: {schema: AnalyzeAgentPerformanceOutputSchema},
  prompt: `You are a laundry service manager providing insights on agent performance.

  Analyze the following agent data and respond to the user query.

  Agent Data:
  {{#each agents}}
  - Name: {{name}}, Last Interaction: {{lastInteractionTime}}, Active Clients: {{activeClients}}, Total Clients Handled: {{totalClientsHandled}}, Avg Time Per Client: {{avgTimePerClient}}, Is Available: {{isAvailable}}, Is On Pause: {{isOnPause}}
  {{/each}}

  User Query: {{{query}}}

  Provide specific, actionable suggestions to improve agent efficiency and customer satisfaction, referencing data where possible.
  `,
});

const analyzeAgentPerformanceFlow = ai.defineFlow(
  {
    name: 'analyzeAgentPerformanceFlow',
    inputSchema: AnalyzeAgentPerformanceInputSchema,
    outputSchema: AnalyzeAgentPerformanceOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
