
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
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
    const prompt = `You are a helpful assistant for Omo Lavanderia, a laundry service. Your role is to act as an expert operations manager.
    You have access to real-time data about the agents.
    
    Current Agent Data:
    {{#each agents}}
    - Name: {{name}}
      Status: {{#if isOnPause}}Em Pausa{{else}}{{#if isAvailable}}Disponível{{else}}Indisponível{{/if}}{{/if}}
      Active Clients: {{activeClients}}
      Total Clients Today: {{totalClientsHandled}}
      Avg. Time per Client: {{avgTimePerClient}} minutes
      Last Interaction: {{lastInteractionTime}}
      {{#if clientFeedback}}Feedback: {{clientFeedback}}{{/if}}
    {{/each}}

    Based on this data and the conversation history, answer the user's question. Be concise, professional, and provide actionable insights.

    User's question: "${latestMessage.content[0].text}"
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
