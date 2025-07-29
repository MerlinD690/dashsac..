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
 * Busca os chats ativos da API do TomTicket.
 * @returns Uma lista de todos os chats ativos.
 */
async function getActiveChatsFromApi(): Promise<TomTicketChat[]> {
  const apiToken = process.env.TOMTICKET_API_TOKEN;
  if (!apiToken) {
    console.error('TOMTICKET_API_TOKEN não está definido no arquivo .env');
    throw new Error('Token da API não configurado.');
  }

  const baseUrl = 'https://api.tomticket.com/v2.0/chat/list';
  const url = `${baseUrl}?situation=2&page=1`; // Busca somente a primeira página por enquanto

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
      },
      cache: 'no-store', // Garante que a requisição não seja cacheada
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Erro na API TomTicket (${response.status}): ${errorBody}`);
        throw new Error(`Falha na comunicação com a API TomTicket: status ${response.status}`);
    }

    const result: TomTicketApiResponse = await response.json();
    
    if (result.success && result.data) {
        return result.data;
    } else {
        return [];
    }
  } catch (error) {
    console.error('Erro ao buscar chats da API do TomTicket:', error);
    throw error;
  }
}

/**
 * Sincroniza os dados do TomTicket com o Firestore.
 */
export async function syncTomTicketData() {
  try {
    console.log('Iniciando sincronização com TomTicket...');
    const activeChats = await getActiveChatsFromApi();
    
    // 1. Contar clientes por atendente da API
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
    
    // 3. Atualizar cada atendente no Firestore
    const batch = writeBatch(db);
    const now = new Date().toISOString();

    for (const agent of ourAgents) {
        const agentRef = doc(db, 'AtendimentoSAC', agent.id);
        const activeClients = agentClientCount.get(agent.tomticketName || '') || 0;
        
        // Se a contagem for diferente, atualiza
        if (agent.activeClients !== activeClients) {
            batch.update(agentRef, { 
                activeClients: activeClients,
                lastInteractionTime: now 
            });
             console.log(`Atualizando ${agent.name}: ${activeClients} clientes ativos.`);
        }
    }
    
    await batch.commit();
    console.log('Sincronização com TomTicket finalizada com sucesso.');

  } catch (error) {
    console.error('Erro durante a sincronização com o TomTicket:', error);
  }
}
