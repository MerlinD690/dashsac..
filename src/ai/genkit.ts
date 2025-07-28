/**
 * @fileoverview This file initializes and configures the Genkit AI library.
 */
'use server';

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GEMINI_API_KEY,
    }),
  ],
  logSinks: [process.env.NODE_ENV === 'development' ? 'dev' : 'prod'],
  enableTracing: process.env.NODE_ENV === 'development',
});
