import { Genkit } from '@genkit-ai/ai';
import { googleAi } from '@genkit-ai/googleai';

export const ai = new Genkit({
  apis: [googleAi({ key: process.env.GEMINI_API_KEY })],
  defaultApis: [googleAi()],
  defaultModel: 'gemini-pro',
});