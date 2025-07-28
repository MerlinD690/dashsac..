
import type { TomTicketApiResponse } from './types';
import { subMinutes, format } from 'date-fns';

const TOMTICKET_API_URL = 'https://api.tomticket.com/v2.0';

export async function getActiveChats(apiToken: string): Promise<TomTicketApiResponse> {
  if (!apiToken) {
    throw new Error('API token was not provided to getActiveChats function.');
  }

  try {
    const fiveMinutesAgo = subMinutes(new Date(), 5);
    const formattedDate = format(fiveMinutesAgo, 'yyyy-MM-dd HH:mm:ss');
    
    const url = new URL(`${TOMTICKET_API_URL}/chat/list`);
    url.searchParams.append('creation_date_ge', formattedDate);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
      },
      cache: 'no-store', // Ensure we always get fresh data
    });

    if (!response.ok) {
       const errorText = await response.text();
       console.error('TomTicket API Error Response:', errorText);
       throw new Error(`Erro na API TomTicket: Status ${response.status} - ${response.statusText}`);
    }

    const data: TomTicketApiResponse = await response.json();
    return data;

  } catch (error) {
    console.error('Falha ao buscar chats do TomTicket:', error);
    if (error instanceof Error) {
        throw new Error(`Falha na comunicação com a API TomTicket: ${error.message}`);
    }
    throw new Error("Ocorreu um erro desconhecido ao buscar chats do TomTicket.");
  }
}
