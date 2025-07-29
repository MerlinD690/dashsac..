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


// --- LÓGICA DE SINCRONIZAÇÃO TOMTICKET (RECRIADA DO ZERO) ---

/**
 * Busca os chats ativos da API do TomTicket, respeitando o rate limit.
 * @returns Uma lista de todos os chats ativos.
 */
async function getActiveChatsFromApi(): Promise<TomTicketChat[]> {
  // A lógica de busca será implementada aqui no próximo passo.
  console.log('Fase 1: getActiveChatsFromApi foi chamada, mas ainda não tem lógica.');
  return []; // Retorna um array vazio por enquanto.
}

/**
 * Sincroniza os dados do TomTicket com o Firestore.
 * 1. Busca os chats ativos da API.
 * 2. Conta quantos clientes cada atendente tem.
 * 3. Atualiza o campo 'activeClients' no Firestore.
 */
export async function syncTomTicketData() {
  try {
    console.log('Fase 1: Iniciando syncTomTicketData.');
    const activeChats = await getActiveChatsFromApi();
    
    // A lógica de contagem e atualização será implementada aqui no próximo passo.
    console.log(`Fase 1: ${activeChats.length} chats recebidos (ainda é um esqueleto).`);

  } catch (error) {
    console.error('Erro durante a sincronização com o TomTicket:', error);
    // Não vamos mais jogar o erro para não quebrar o cliente, apenas logar.
  }
}
