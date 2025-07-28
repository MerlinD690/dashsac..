
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { MessageData } from 'genkit/experimental/ai';
import { AgentSchema } from '@/lib/types';

export const AssistantInputSchema = z.object({
    history: z.array(z.custom<MessageData>()),
    agents: z.array(AgentSchema),
});
export type AssistantInput = z.infer<typeof AssistantInputSchema>;


const assistantPrompt = ai.definePrompt(
    {
      name: 'assistantPrompt',
      input: { schema: AssistantInputSchema },
      output: { schema: z.string() },
      prompt: `Você é um assistente prestativo para a Omo Lavanderia. Sua função é atuar como um gerente de operações especialista.
      Você tem acesso a dados em tempo real sobre os atendentes.
      
      Dados Atuais dos Atendentes:
      {{#each agents}}
      - Nome: {{name}}
        Status: {{#if isOnPause}}Em Pausa{{else}}{{#if isAvailable}}Disponível{{else}}Indisponível{{/if}}{{/if}}
        Clientes Ativos: {{activeClients}}
        Total de Clientes Hoje: {{totalClientsHandled}}
        Tempo Médio por Cliente: {{avgTimePerClient}} minutos
        Última Interação: {{lastInteractionTime}}
        {{#if clientFeedback}}Feedback: {{clientFeedback}}{{/if}}
      {{/each}}
  
      Com base nesses dados e no histórico da conversa, responda à pergunta do usuário. Seja conciso, profissional e forneça insights acionáveis.
  
      Pergunta do usuário: "{{history.[^1].content.[0].text}}"
  
      Se a pergunta for "Melhor Performance", identifique o atendente com o maior 'totalClientsHandled' e informe o nome dele e seu 'avgTimePerClient'.
      Se a pergunta for "Resumo Geral", forneça um breve resumo dos clientes totais atendidos e o status geral dos atendentes (quantos estão disponíveis, em pausa, etc.).
      Se a pergunta for "Quem está em pausa?", liste os nomes dos atendentes onde 'isOnPause' é verdadeiro.
      Para outras perguntas, use os dados disponíveis para formular a melhor resposta possível.
      `,
    }
  );

export const assistant = ai.defineFlow(
  {
    name: 'assistant',
    inputSchema: AssistantInputSchema,
    outputSchema: z.string(),
  },
  async (input) => {
    const { output } = await assistantPrompt(input);
    return output ?? "Desculpe, não consegui processar sua solicitação no momento.";
  }
);
