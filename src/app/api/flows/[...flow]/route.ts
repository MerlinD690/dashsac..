/**
 * @fileoverview This file creates a Next.js route handler for Genkit flows.
 */

import { nextHandler } from '@genkit-ai/next';
import '@/ai/flows/analyzeAgents';

export const POST = nextHandler();
