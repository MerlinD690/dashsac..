
import type { TomTicketApiResponse } from './types';
import { subMinutes, format } from 'date-fns';
import axios from 'axios';

const TOMTICKET_API_URL = 'https://api.tomticket.com/v2.0';

export async function getActiveChats(apiToken: string): Promise<TomTicketApiResponse> {
  if (!apiToken) {
    throw new Error('API token was not provided to getActiveChats function.');
  }

  try {
    const fiveMinutesAgo = subMinutes(new Date(), 5);
    const formattedDate = format(fiveMinutesAgo, 'yyyy-MM-dd HH:mm:ss');
    
    const response = await axios.get(`${TOMTICKET_API_URL}/chat/list`, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
      },
      params: {
        'creation_date_ge': formattedDate,
      },
      timeout: 10000, // 10 second timeout
    });

    if (response.status !== 200 || !response.data) {
        throw new Error(`Erro na API TomTicket: Status ${response.status} - ${response.statusText}`);
    }

    return response.data;

  } catch (error) {
    console.error('Falha ao buscar chats do TomTicket com Axios:', error);
    if (axios.isAxiosError(error)) {
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error('TomTicket API Error Response Data:', error.response.data);
            console.error('TomTicket API Error Response Status:', error.response.status);
            if (error.response.status === 401) {
                throw new Error('Erro na API TomTicket: Não autorizado (401). Verifique o token.');
            }
            throw new Error(`Erro na API TomTicket: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
            // The request was made but no response was received
            throw new Error('Falha na comunicação com a API TomTicket: Nenhuma resposta recebida.');
        }
    }
    // Something happened in setting up the request that triggered an Error
    if (error instanceof Error) {
        throw new Error(`Falha na comunicação com a API TomTicket: ${error.message}`);
    }
    throw new Error("Ocorreu um erro desconhecido ao buscar chats do TomTicket.");
  }
}
