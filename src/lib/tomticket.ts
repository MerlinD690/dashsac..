
import type { TomTicketApiResponse } from './types';
import { subMinutes, format } from 'date-fns';

const TOMTICKET_API_URL = 'https://api.tomticket.com/v2.0';

export async function getActiveChats(): Promise<TomTicketApiResponse> {
  const apiToken = process.env.TOMTICKET_API_TOKEN;

  if (!apiToken) {
    console.error("TOMTICKET_API_TOKEN não está configurado. Verifique o arquivo .env ou as configurações de ambiente da Vercel.");
    throw new Error('TOMTICKET_API_TOKEN não está configurado nas variáveis de ambiente.');
  }

  try {
    // Calculate the timestamp for 5 minutes ago
    const fiveMinutesAgo = subMinutes(new Date(), 5);
    // Format it to YYYY-MM-DD HH:mm:ss
    const formattedDate = format(fiveMinutesAgo, 'yyyy-MM-dd HH:mm:ss');
    // URL-encode the date string
    const encodedDate = encodeURIComponent(formattedDate);
    
    // Append the query parameter to the URL
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
