
'use server';

import type { TomTicketApiResponse, TomTicketChat } from './types';

// A lógica foi movida para actions.ts para garantir que ela
// rode em um ambiente de servidor puro e tenha acesso direto
// às variáveis de ambiente, além de permitir um controle mais fino
// sobre a construção da URL.
// Esta função é mantida para evitar quebras de importação, mas não é chamada.
export async function getActiveChats(apiToken: string): Promise<TomTicketChat[]> {
   console.warn("getActiveChats in lib/tomticket.ts was called, but is deprecated. Logic has moved to actions.ts");
   // Retornar um array vazio para não quebrar a lógica que ainda pode chamar isso.
   return [];
}
