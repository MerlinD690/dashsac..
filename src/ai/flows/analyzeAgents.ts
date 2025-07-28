
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
  prompt: `Você é um analista de dados especialista em performance de contact centers. Sua tarefa é analisar os dados de atendentes já processados e o histórico de performance para identificar tendências.

Responda SEMPRE em português do Brasil.

Dados dos Atendentes do Dia (o tempo de pausa já foi calculado e formatado):
{{{json agents}}}

Total de Clientes Atendidos no Dia: {{{totalClientsToday}}}

Dados Históricos (Relatórios dos dias anteriores):
{{{json historicalData}}}

Com base em **todos** os dados fornecidos (do dia e históricos), você deve:

**Parte 1: Análise do Dia**
1.  O campo 'totalPauseTime' já contém o tempo de pausa formatado. Use-o diretamente.
2.  Identificar o atendente mais produtivo do dia (maior número de clientes atendidos). Este será o "Atendente em Destaque" do dia.
3.  Identificar o atendente menos produtivo do dia (menor número de clientes atendidos).
4.  Gerar um resumo de performance para cada atendente para o dia, usando os dados fornecidos (nome, clientes atendidos, tempo de pausa).
5.  Escrever um resumo geral sobre o dia, levando em conta o número total de clientes atendidos.

**Parte 2: Análise Histórica e Estratégica (Campo 'historicalAnalysis')**
1.  Analise os 'historicalData' em conjunto com os dados do dia para identificar tendências.
2.  Destaque a consistência: Qual atendente se mantém como o mais produtivo na maioria dos dias? Existe algum atendente que consistentemente fica entre os menos produtivos? Use os números para justificar (ex: "Beatriz foi a mais produtiva em 3 dos últimos 5 dias.").
3.  Compare a produtividade geral: O total de clientes de hoje foi maior ou menor que a média dos últimos dias?
4.  Gere insights e recomendações ESTRATÉGICAS. Por exemplo, se um atendente está consistentemente sobrecarregado, sugira uma redistribuição de tarefas ou um bônus. Se a equipe toda está caindo de produção, sugira investigar a causa.
5.  Seja direto, use os dados e os números para embasar cada afirmação na análise histórica.

Responda estritamente no formato JSON definido pelo esquema de saída. Preencha todos os campos, incluindo a 'historicalAnalysis'.`,
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

    const { output } = await analysisPrompt(input);
    
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
