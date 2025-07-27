
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { MessageData } from 'genkit/experimental/ai';
import { Agent, AssistantInputSchema, AssistantInput } from '@/lib/types';


export const assistantFlow = ai.defineFlow(
  {
    name: 'assistantFlow',
    inputSchema: AssistantInputSchema,
    outputSchema: z.string(),
  },
  async ({ history, agents }) => {
    const latestMessage = history[history.length - 1];
    const prompt = `Você é um assistente prestativo para a Omo Lavanderia. Sua função é atuar como um gerente de operações especialista.
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

    Pergunta do usuário: "${latestMessage.content[0].text}"
    `;
    
    const llmResponse = await ai.generate({
      prompt: prompt,
      model: 'googleai/gemini-1.5-flash',
      history: history,
      context: [
          {
              role: 'system',
              content: [{text: prompt.replace(/\{\{.*?\}\}/g, '')}]
          }
      ],
      config: {
        temperature: 0.5,
      },
      input: {
        agents,
      },
    });

    return llmResponse.text();
  }
);
