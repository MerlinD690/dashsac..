
// IMPORTANT: This file is required for Genkit flows to work with Next.js.
// @see https://firebase.google.com/docs/genkit/nextjs-framework#deploy-to-app-hosting
import {defineFlows} from '@genkit-ai/next';
import '@/ai/dev';

export const {POST} = defineFlows();
