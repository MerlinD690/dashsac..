'use server';

import { subMinutes, format } from 'date-fns';
import type { TomTicketApiResponse, TomTicketChat } from './types';

// This function is no longer used, the logic was moved to actions.ts
// to ensure it runs in a pure server environment.
// It is kept here to avoid breaking imports, but it's not called.
export async function getActiveChats(apiToken: string): Promise<TomTicketChat[]> {
   console.warn("getActiveChats in lib/tomticket.ts was called, but is deprecated. Logic has moved to actions.ts");
   return [];
}
