'use server';

require('dotenv').config();

import { db } from '@/lib/firebase';
import { AgentDocument, PauseLogDocument, DailyReport, TomTicketChat } from '@/lib/types';
import { collection, getDocs, doc, writeBatch, updateDoc, addDoc, query, where, orderBy, limit, setDoc } from 'firebase/firestore';
import { format } from 'date-fns';

const API_TOKEN = process.env.TOMTICKET_API_TOKEN;
const API_URL = "https://api.tomticket.com/v2.0/chat/list";

// Função auxiliar para buscar todos os chats ativos, cuidando da paginação.
async function getActiveChatsFromApi(): Promise<TomTicketChat[]> {
  if (!API_TOKEN) {
    throw new Error("TOMTICKET_API_TOKEN não foi configurado no arquivo .env");
  }

  let allChats: TomTicketChat[] = [];
  let currentPage = 1;
  let hasMorePages = true;

  while (hasMorePages) {
    try {
      const response = await fetch(`${API_URL}?page=${currentPage}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
        },
        cache: 'no-store' // Garante que não estamos usando uma resposta em cache
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Erro na API TomTicket (página ${currentPage}): ${response.status} ${response.statusText}`, errorBody);
        throw new Error(`Falha ao buscar dados da TomTicket. Status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        console.error("API TomTicket retornou erro:", result.message);
        throw new Error(`Erro da API TomTicket: ${result.message}`);
      }

      const activeChats = result.data.filter((chat: TomTicketChat) => 
        chat.situation == 1 || chat.situation == 2 // 1: Aguardando, 2: Em conversa
      );
      
      allChats = allChats.concat(activeChats);

      // Verifica se há mais páginas para buscar
      hasMorePages = result.pagination && result.pagination.next_page !== null;
      if (hasMorePages) {
        currentPage++;
      }

    } catch (error) {
      console.error("Erro crítico ao conectar com a API TomTicket:", error);
      // Paramos o loop em caso de erro de rede para não sobrecarregar
      throw new Error("Não foi possível conectar à API da TomTicket.");
    }
  }

  return allChats;
}


export async function syncTomTicketData() {
  console.log('[Sync] Iniciando sincronização com a API do TomTicket...');
  
  const allAgentsSnapshot = await getDocs(collection(db, "AtendimentoSAC"));
  const allAgents = allAgentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AgentDocument & { id: string }));

  if (allAgents.length === 0) {
    console.warn("[Sync] Nenhum atendente cadastrado no Firestore. Abortando.");
    return { totalChats: 0 };
  }

  const activeChats = await getActiveChatsFromApi();
  console.log(`[Sync] Encontrados ${activeChats.length} chats ativos (situação 1 ou 2) na API.`);

  const agentChatCounts: { [tomticketName: string]: number } = {};
  for (const chat of activeChats) {
    if (chat.operator && chat.operator.name) {
      agentChatCounts[chat.operator.name] = (agentChatCounts[chat.operator.name] || 0) + 1;
    }
  }
  console.log('[Sync] Contagem de chats por atendente:', agentChatCounts);

  const batch = writeBatch(db);
  const now = new Date().toISOString();

  allAgents.forEach(agent => {
    const tomticketName = agent.tomticketName;
    const activeClientCount = tomticketName ? (agentChatCounts[tomticketName] || 0) : 0;
    
    // Incrementa o total apenas se o número de clientes aumentou desde a última checagem (evita contagem dupla)
    const newTotalClients = agent.activeClients < activeClientCount 
      ? agent.totalClientsHandled + (activeClientCount - agent.activeClients)
      : agent.totalClientsHandled;

    const agentRef = doc(db, 'AtendimentoSAC', agent.id);
    batch.update(agentRef, { 
      activeClients: activeClientCount,
      totalClientsHandled: newTotalClients,
      lastInteractionTime: now,
    });
  });

  await batch.commit();
  console.log(`[Sync] Sincronização concluída. ${allAgents.length} atendentes atualizados.`);
  return { totalChats: activeChats.length };
}


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
