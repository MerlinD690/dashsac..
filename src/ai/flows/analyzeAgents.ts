
/**
 * @fileOverview An AI flow to analyze agent performance data.
 */
'use server';

import { ai } from '@/ai/genkit';
import { AnalysisInput, AnalysisInputSchema, AnalysisOutput, AnalysisOutputSchema } from '@/lib/types';

const analysisPrompt = ai.definePrompt({
  name: 'analysisPrompt',
  model: 'googleai/gemini-1.5-flash-latest',
  input: { schema: AnalysisInputSchema },
  output: { schema: AnalysisOutputSchema },
  prompt: `Você é um analista de dados especialista em performance de contact centers.
    Sua tarefa é analisar os dados brutos de atendentes e pausas fornecidos em formato JSON.

    Dados:
    Atendentes: {{{json agents}}}
    Pausas: {{{json pauseLogs}}}

    Com base nesses dados, você deve:
    1.  Calcular o tempo total de pausa para cada atendente. Some a duração de todos os registros de pausa para cada um. O tempo é a diferença entre pauseEndTime e pauseStartTime.
    2.  Identificar o atendente mais produtivo (maior número de clientes atendidos).
    3.  Identificar o atendente menos produtivo (menor número de clientes atendidos).
    4.  Gerar um resumo de performance para cada atendente, incluindo nome, clientes atendidos e tempo total de pausa em minutos.
    5.  Escrever um resumo geral sobre o dia, destacando a produtividade geral, a distribuição de trabalho e quaisquer observações ou recomendações importantes.

    Responda estritamente no formato JSON definido pelo esquema de saída. Calcule o tempo de pausa em minutos e arredonde para o número inteiro mais próximo.`,
});

const analyzeAgentsFlow = ai.defineFlow(
  {
    name: 'analyzeAgentsFlow',
    inputSchema: AnalysisInputSchema,
    outputSchema: AnalysisOutputSchema,
  },
  async (input: AnalysisInput) => {
    const { output } = await analysisPrompt(input);
    if (!output) {
        throw new Error("A análise da IA não retornou uma resposta válida.");
    }
    return output;
  }
);


export async function analyzeAgents(input: AnalysisInput): Promise<AnalysisOutput> {
  return analyzeAgentsFlow(input);
}
