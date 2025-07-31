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
    console.error("TOMTICKET_API_TOKEN não configurado. Verifique o arquivo .env");
    throw new Error("TOMTICKET_API_TOKEN não foi configurado.");
  }

  let allChats: TomTicketChat[] = [];
  let currentPage = 1;
  let hasMorePages = true;

  while (hasMorePages) {
    try {
      // Constrói a URL para a página atual
      const url = `${API_URL}?page=${currentPage}`;
      console.log(`[Sync] Buscando dados da TomTicket: ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
        },
        cache: 'no-store'
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

      // Filtra os chats em "Aguardando" (1) ou "Em conversa" (2)
      const activeChats = result.data.filter((chat: TomTicketChat) => 
        chat.situation == '1' || chat.situation == '2'
      );
      
      allChats = allChats.concat(activeChats);

      // Verifica se há mais páginas para buscar
      hasMorePages = result.pagination && result.pagination.next_page !== null;
      if (hasMorePages) {
        currentPage++;
      }

    } catch (error) {
      console.error("Erro crítico ao conectar com a API TomTicket:", error);
      throw new Error("Não foi possível conectar à API da TomTicket.");
    }
  }
  console.log(`[Sync] Total de ${allChats.length} chats ativos encontrados em todas as páginas.`);
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

  // 1. Buscar todos os chats ativos da API
  const activeChats = await getActiveChatsFromApi();
  
  // 2. Contar quantos chats cada atendente (pelo tomticketName) possui
  const agentChatCounts: { [tomticketName: string]: number } = {};
  for (const chat of activeChats) {
    // Garante que o operador existe e tem um nome antes de contar
    if (chat.operator && chat.operator.name) {
      agentChatCounts[chat.operator.name] = (agentChatCounts[chat.operator.name] || 0) + 1;
    }
  }
  console.log('[Sync] Contagem de chats por atendente da API:', agentChatCounts);

  const batch = writeBatch(db);
  const now = new Date().toISOString();

  // 3. Atualizar cada atendente no Firestore
  allAgents.forEach(agent => {
    const tomticketName = agent.tomticketName;
    // Pega a contagem do mapa ou define 0 se o atendente não tiver chats ativos
    const activeClientCount = tomticketName ? (agentChatCounts[tomticketName] || 0) : 0;
    
    // Lógica para incrementar o total de atendimentos do dia
    // Incrementa o total apenas se a contagem de clientes aumentou (evita contagem dupla)
    const newTotalClients = agent.activeClients < activeClientCount 
      ? agent.totalClientsHandled + (activeClientCount - agent.activeClients)
      : agent.totalClientsHandled;

    const agentRef = doc(db, 'AtendimentoSAC', agent.id);
    batch.update(agentRef, { 
      activeClients: activeClientCount,
      totalClientsHandled: newTotalClients,
      lastInteractionTime: now, // Atualiza a interação para o momento da sincronização
    });
  });

  await batch.commit();
  console.log(`[Sync] Sincronização concluída. ${allAgents.length} atendentes atualizados no Firestore.`);
  
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
