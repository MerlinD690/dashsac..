'use server';

require('dotenv').config();

import { db } from '@/lib/firebase';
import { AgentDocument, PauseLogDocument, DailyReport, TomTicketApiResponse, TomTicketChat } from '@/lib/types';
import { collection, getDocs, doc, writeBatch, updateDoc, addDoc, query, where, orderBy, limit, setDoc } from 'firebase/firestore';
import { format } from 'date-fns';

export async function clearAndSeedAgents(agents: AgentDocument[]) {
  const batch = writeBatch(db);
  const agentsCollection = collection(db, 'AtendimentoSAC');

  // 1. Delete all existing agents
  const querySnapshot = await getDocs(agentsCollection);
  querySnapshot.forEach(doc => {
    batch.delete(doc.ref);
  });
  console.log('Existing agents marked for deletion.');

  // 2. Seed new agents
  agents.forEach((agent) => {
    const agentRef = doc(agentsCollection); // Let firestore generate ID
    batch.set(agentRef, agent);
  });
  console.log('New agents marked for seeding.');

  // Commit the batch
  await batch.commit();
  console.log('Batch commit successful: Agents cleared and seeded.');
}

export async function updateAgent(agentId: string, data: Partial<AgentDocument>) {
  const agentRef = doc(db, 'AtendimentoSAC', agentId);
  await updateDoc(agentRef, data);
}

export async function addPauseLog(log: PauseLogDocument) {
  await addDoc(collection(db, 'pause_logs'), log);
}

export async function getPauseLogsInRange(startDate: Date, endDate: Date): Promise<PauseLogDocument[]> {
  const pauseLogsCollection = collection(db, 'pause_logs');
  const q = query(
    pauseLogsCollection,
    where('pause_start_time', '>=', startDate.toISOString()),
    where('pause_start_time', '<=', endDate.toISOString())
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data() as PauseLogDocument);
}

export async function addDailyReport(report: Omit<DailyReport, 'date'>) {
    const today = format(new Date(), 'yyyy-MM-dd');
    const reportRef = doc(db, 'daily_reports', today);
    const reportWithDate: DailyReport = {
        ...report,
        date: today,
    };

    // Use set with merge option to create or overwrite the report
    await setDoc(reportRef, reportWithDate, { merge: true });
}

export async function getDailyReports(days = 30): Promise<DailyReport[]> {
  const reportsCollection = collection(db, 'daily_reports');
  const q = query(reportsCollection, orderBy('date', 'desc'), limit(days));
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data() as DailyReport);
}


// --- LÓGICA DE SINCRONIZAÇÃO TOMTICKET (RECONSTRUÍDA DO ZERO) ---

/**
 * Busca os chats ativos da API do TomTicket, respeitando o rate limit.
 * @returns Uma lista de todos os chats ativos.
 */
async function getActiveChatsFromApi(): Promise<TomTicketChat[]> {
  const apiToken = process.env.TOMTICKET_API_TOKEN;
  if (!apiToken) {
    console.error('TOMTICKET_API_TOKEN não está definido no arquivo .env');
    throw new Error('Token da API não configurado.');
  }

  const baseUrl = 'https://api.tomticket.com/v2.0/chat/list';
  const allChats: TomTicketChat[] = [];

  try {
    // 1. Primeira chamada para descobrir a paginação
    const firstPageUrl = `${baseUrl}?situation=2&page=1`;
    const firstResponse = await fetch(firstPageUrl, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiToken}` },
      cache: 'no-store',
    });

    if (!firstResponse.ok) {
      const errorBody = await firstResponse.text();
      console.error(`Erro na API TomTicket (página 1: ${firstResponse.status}): ${errorBody}`);
      throw new Error(`Falha na comunicação com a API TomTicket: status ${firstResponse.status}`);
    }

    const firstResult: TomTicketApiResponse = await firstResponse.json();
    if (firstResult.success && firstResult.data) {
      allChats.push(...firstResult.data);
    } else if (!firstResult.success) {
      console.error(`A API TomTicket retornou um erro na página 1: ${firstResult.message}`);
      // Decidimos não lançar um erro aqui para não quebrar o ciclo, mas logamos.
    }

    const totalPages = firstResult.pagination.last_page;
    if (totalPages <= 1) {
      return allChats;
    }

    // 2. Criar uma lista de páginas restantes para buscar
    const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
    
    // 3. Processar em lotes para respeitar o rate limit (3 req/sec)
    const batchSize = 3;
    for (let i = 0; i < remainingPages.length; i += batchSize) {
        const batch = remainingPages.slice(i, i + batchSize);
        
        const batchPromises = batch.map(page => {
            const url = `${baseUrl}?situation=2&page=${page}`;
            return fetch(url, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${apiToken}` },
                cache: 'no-store',
            }).then(async (res) => {
                if (!res.ok) {
                    // Loga o erro mas não quebra o lote inteiro
                    console.error(`Erro ao buscar página ${page}: ${res.status}`);
                    return null; // Retorna nulo para ser filtrado depois
                }
                const pageResult = await res.json() as TomTicketApiResponse;
                if (!pageResult.success) {
                    console.error(`A API TomTicket retornou um erro na página ${page}: ${pageResult.message}`);
                    return null;
                }
                return pageResult;
            }).catch(err => {
                console.error(`Erro de rede na página ${page}:`, err);
                return null;
            });
        });

        const results = await Promise.all(batchPromises);

        for (const result of results) {
            if (result && result.data) {
                allChats.push(...result.data);
            }
        }

        // Pausa de 1.1 segundos entre os lotes para garantir a conformidade com o rate limit
        if (i + batchSize < remainingPages.length) {
            await new Promise(resolve => setTimeout(resolve, 1100));
        }
    }
    
    return allChats;

  } catch (error) {
    console.error('Erro geral ao buscar chats da API do TomTicket:', error);
    throw error;
  }
}

/**
 * Sincroniza os dados do TomTicket com o Firestore.
 */
export async function syncTomTicketData() {
  try {
    const activeChats = await getActiveChatsFromApi();
    console.log(`[Sync] Encontrados ${activeChats.length} chats ativos na API.`);
    
    // 1. Contar clientes por atendente a partir dos dados da API
    const agentClientCount = new Map<string, number>();
    for (const chat of activeChats) {
        if (chat.operator && chat.operator.name) {
            const agentName = chat.operator.name;
            agentClientCount.set(agentName, (agentClientCount.get(agentName) || 0) + 1);
        }
    }

    // 2. Buscar todos os atendentes do nosso Firestore
    const agentsCollection = collection(db, 'AtendimentoSAC');
    const snapshot = await getDocs(agentsCollection);
    const ourAgents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as AgentDocument }));
    
    // 3. Preparar um lote para atualizar todos os atendentes no Firestore
    const batch = writeBatch(db);
    const now = new Date().toISOString();

    for (const agent of ourAgents) {
        const agentRef = doc(db, 'AtendimentoSAC', agent.id);
        const activeClients = agentClientCount.get(agent.tomticketName || '') || 0;
        
        // Sempre atualiza o atendente. 
        // Isso garante que se um atendente ficar com 0 clientes, o valor seja atualizado.
        batch.update(agentRef, { 
            activeClients: activeClients,
            lastInteractionTime: now 
        });
    }
    
    await batch.commit();
    console.log('[Sync] Sincronização com Firestore finalizada.');

  } catch (error) {
    console.error('ERRO no ciclo de sincronização com o TomTicket:', error);
    // Não relançamos o erro para não quebrar o intervalo no front-end
  }
}
