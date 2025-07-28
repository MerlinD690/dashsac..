
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
  prompt: `Você é um analista de dados especialista em performance de contact centers. Sua tarefa é analisar os dados de atendentes já processados.

Responda SEMPRE em português do Brasil.

Dados dos Atendentes (o tempo de pausa já foi calculado e formatado):
{{{json agents}}}

Com base nesses dados, você deve:
1.  O campo 'totalPauseTime' já contém o tempo de pausa formatado. Use-o diretamente.
2.  Identificar o atendente mais produtivo (maior número de clientes atendidos). Este será o "Atendente em Destaque" do dia.
3.  Identificar o atendente menos produtivo (menor número de clientes atendidos).
4.  Gerar um resumo de performance para cada atendente, usando os dados fornecidos (nome, clientes atendidos, tempo de pausa).
5.  Escrever um resumo geral sobre o dia. No resumo, inclua um parágrafo separado com dicas e recomendações gerais sobre a importância de pausas para a produtividade, como gerenciar o número de atendimentos e a eficiência geral da equipe, mantendo um tom construtivo e positivo.

Responda estritamente no formato JSON definido pelo esquema de saída.`,
});

const analyzeAgentsFlow = ai.defineFlow(
  {
    name: 'analyzeAgentsFlow',
    inputSchema: AnalysisInputSchema,
    outputSchema: AnalysisOutputSchema,
  },
  async (input: AnalysisInput) => {
    // A lógica de cálculo agora é feita no cliente. A IA apenas recebe e organiza os dados.
    const agentPerformance = input.agents.map(agent => ({
        name: agent.name,
        clientsHandled: agent.totalClientsHandled,
        totalPauseTime: agent.totalPauseTimeFormatted || '0 segundos',
    }));

    const { output } = await analysisPrompt({ agents: input.agents });
    
    if (!output) {
        throw new Error("A análise da IA não retornou uma resposta válida.");
    }
    
    // Sobrescrevemos a performance da IA com a nossa para garantir precisão
    output.agentPerformance = agentPerformance;

    // A IA ainda identifica o mais e menos produtivo
    let mostProductive = { name: '', clientsHandled: -1 };
    let leastProductive = { name: '', clientsHandled: Infinity };

    input.agents.forEach(agent => {
        if (agent.totalClientsHandled > mostProductive.clientsHandled) {
            mostProductive = { name: agent.name, clientsHandled: agent.totalClientsHandled };
        }
        if (agent.totalClientsHandled < leastProductive.clientsHandled) {
            leastProductive = { name: agent.name, clientsHandled: agent.totalClientsHandled };
        }
    });

    output.mostProductiveAgent = mostProductive;
    // Se todos tiverem 0, não há menos produtivo
    output.leastProductiveAgent = mostProductive.clientsHandled === leastProductive.clientsHandled ? mostProductive : leastProductive;


    return output;
  }
);


export async function analyzeAgents(input: AnalysisInput): Promise<AnalysisOutput> {
  return analyzeAgentsFlow(input);
}
