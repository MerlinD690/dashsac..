
import type { TomTicketApiResponse } from './types';

const TOMTICKET_API_URL = 'https://api.tomticket.com/v2.0';

export async function getActiveChats(): Promise<TomTicketApiResponse> {
  const apiToken = process.env.TOMTICKET_API_TOKEN;

  if (!apiToken) {
    console.error("TOMTICKET_API_TOKEN não está configurado. Verifique o arquivo .env ou as configurações de ambiente da Vercel.");
    throw new Error('TOMTICKET_API_TOKEN não está configurado nas variáveis de ambiente.');
  }

  try {
    const response = await fetch(`${TOMTICKET_API_URL}/chat/list`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Garante que estamos sempre buscando os dados mais recentes
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
        // Lança o erro para que a função que chamou saiba que algo deu errado
        throw new Error(`Falha na comunicação com a API TomTicket: ${error.message}`);
    }
    throw new Error("Ocorreu um erro desconhecido ao buscar chats do TomTicket.");
  }
}
