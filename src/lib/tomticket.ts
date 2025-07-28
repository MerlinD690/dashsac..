
'use server';

import type { TomTicketApiResponse, TomTicketChat } from './types';

// A lógica foi movida para actions.ts para garantir que ela
// rode em um ambiente de servidor puro e tenha acesso direto
// às variáveis de ambiente.
// Esta função é mantida para evitar quebras de importação, mas não é chamada.
export async function getActiveChats(apiToken: string): Promise<TomTicketChat[]> {
   console.warn("getActiveChats in lib/tomticket.ts was called, but is deprecated. Logic has moved to actions.ts");
   return [];
}
