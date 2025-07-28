
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
  prompt: `Você é um analista de dados especialista em performance de contact centers. Sua tarefa é analisar os dados brutos de atendentes e pausas fornecidos em formato JSON.

Responda SEMPRE em português do Brasil.

Dados:
Atendentes: {{{json agents}}}
Pausas: {{{json pauseLogs}}}

Com base nesses dados, você deve:
1.  Para cada atendente, calcular o tempo total de pausa. Para fazer isso, encontre todos os registros de pausa para o atendente, calcule a diferença em milissegundos entre 'pauseEndTime' e 'pauseStartTime' para cada registro, some todas as diferenças e converta o total de milissegundos para MINUTOS. Arredonde o resultado para o número inteiro mais próximo.
2.  Identificar o atendente mais produtivo (maior número de clientes atendidos).
3.  Identificar o atendente menos produtivo (menor número de clientes atendidos).
4.  Gerar um resumo de performance para cada atendente, incluindo nome, clientes atendidos e o tempo total de pausa em minutos (como um número inteiro).
5.  Escrever um resumo geral sobre o dia em português, destacando a produtividade geral e quaisquer observações ou recomendações importantes.

Responda estritamente no formato JSON definido pelo esquema de saída.`,
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
