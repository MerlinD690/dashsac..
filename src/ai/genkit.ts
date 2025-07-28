/**
 * @fileoverview This file initializes and configures the Genkit AI library.
 */
'use server';

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { GENKIT_ENV } from '@genkit-ai/next/plugin';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GEMINI_API_KEY,
    }),
  ],
  logSinks: [GENKIT_ENV === 'dev' ? 'dev' : 'prod'],
  enableTracing: GENKIT_ENV === 'dev',
});
