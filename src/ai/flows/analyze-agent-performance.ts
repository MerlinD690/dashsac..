
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
  prompt: `Você é um gerente de lavanderia que fornece insights sobre o desempenho dos atendentes.

  Analise os seguintes dados dos atendentes e responda à consulta do usuário.

  Dados dos Atendentes:
  {{#each agents}}
  - Nome: {{name}}, Última Interação: {{lastInteractionTime}}, Clientes Ativos: {{activeClients}}, Total de Clientes Atendidos: {{totalClientsHandled}}, Tempo Médio por Cliente: {{avgTimePerClient}}, Está Disponível: {{isAvailable}}, Está em Pausa: {{isOnPause}}
  {{/each}}

  Consulta do Usuário: {{{query}}}

  Forneça sugestões específicas e acionáveis para melhorar a eficiência dos atendentes e a satisfação do cliente, referenciando os dados sempre que possível.
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
    return output ?? 'Desculpe, não foi possível analisar a performance neste momento.';
  }
);
