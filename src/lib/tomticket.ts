
import type { TomTicketApiResponse } from './types';
import { subMinutes, format } from 'date-fns';

const TOMTICKET_API_URL = 'https://api.tomticket.com/v2.0';

// The function now receives the token as an argument
export async function getActiveChats(apiToken: string): Promise<TomTicketApiResponse> {
  if (!apiToken) {
    throw new Error('API token was not provided to getActiveChats function.');
  }

  try {
    const fiveMinutesAgo = subMinutes(new Date(), 5);
    const formattedDate = format(fiveMinutesAgo, 'yyyy-MM-dd HH:mm:ss');
    const encodedDate = encodeURIComponent(formattedDate);
    
    const requestUrl = `${TOMTICKET_API_URL}/chat/list?creation_date_ge=${encodedDate}`;

    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Erro na API TomTicket:", errorBody);
        if (response.status === 401) {
             throw new Error(`Erro na API TomTicket: Unauthorized`);
        }
        throw new Error(`Erro na API TomTicket: ${response.statusText}`);
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
