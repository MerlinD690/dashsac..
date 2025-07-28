
/**
 * @fileoverview This file initializes and aconfigures the Genkit AI library.
 */

import { genkit, GenkitPlugin } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

// We are defining the plugins array here, and will conditionally add the googleAI plugin.
const plugins: GenkitPlugin[] = [];

// Only add the Google AI plugin if the API key is available.
if (process.env.GEMINI_API_KEY) {
  plugins.push(googleAI({
    apiKey: process.env.GEMINI_API_KEY,
  }));
}

export const ai = genkit({
  plugins,
  logSinks: process.env.NODE_ENV === 'development' ? ['dev'] : [],
  enableTracing: process.env.NODE_ENV === 'development',
});
