/**
 * @fileoverview This file creates a Next.js route handler for Genkit flows.
 */

import * as genkitNext from '@genkit-ai/next';
import '@/ai/flows/analyzeAgents';

export const POST = genkitNext.nextHandler();
