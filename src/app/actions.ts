'use server';

import { db } from '@/lib/firebase';
import { AgentDocument, PauseLogDocument, DailyReport, TomTicketApiResponse, TomTicketChat } from '@/lib/types';
import { collection, getDocs, doc, writeBatch, updateDoc, addDoc, query, where, orderBy, limit, setDoc, getDoc } from 'firebase/firestore';
import { format, subMinutes } from 'date-fns';

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
  agents.forEach((agent, index) => {
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


async function getActiveChats(apiToken: string): Promise<TomTicketChat[]> {
    const TOMTICKET_API_URL = 'https://api.tomticket.com/v2.0';
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
                'authorization': `Bearer ${apiToken}`,
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('TomTicket API Error Response:', errorText);
            throw new Error(`Erro na API TomTicket: Status ${response.status} - ${response.statusText}`);
        }

        const data: TomTicketApiResponse = await response.json();
        return data.data || [];

    } catch (error) {
        console.error('Falha ao buscar chats do TomTicket:', error);
        if (error instanceof Error) {
            throw new Error(`Falha na comunicação com a API TomTicket: ${error.message}`);
        }
        throw new Error("Ocorreu um erro desconhecido ao buscar chats do TomTicket.");
    }
}


export async function syncTomTicketData() {
  console.log("Starting TomTicket data sync...");
  try {
    const apiToken = "9a152bbee93cb69a54e99ca1070ba6e0aba9d8e086b65916a7e364c87057323c";
    
    if (!apiToken) {
        const errorMessage = "[CRITICAL] TomTicket API Token is not available.";
        console.error(errorMessage);
        throw new Error(errorMessage);
    }
    
    console.log(`[DIAGNOSTIC] Using token starting with: ${apiToken.substring(0, 4)}...`);


    const allChats = await getActiveChats(apiToken);
    
    const activeChats = allChats.filter(chat => chat.situation === 1 || chat.situation === 2);
    console.log(`Found ${allChats.length} total chats in the last 5 minutes. Found ${activeChats.length} active chats (situation 1 or 2).`);

    const agentChatCounts: { [key: string]: number } = {};
    for (const chat of activeChats) {
      const agentName = chat.operator?.name; 
      if (agentName) {
        if (!agentChatCounts[agentName]) {
          agentChatCounts[agentName] = 0;
        }
        agentChatCounts[agentName]++;
      }
    }
    console.log("Counted TomTicket agent chats:", agentChatCounts);

    const agentsCollection = collection(db, 'AtendimentoSAC');
    const agentsSnapshot = await getDocs(agentsCollection);
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    let updatesMade = 0;

    agentsSnapshot.docs.forEach(doc => {
      const agent = doc.data() as AgentDocument;
      const agentRef = doc.ref;
      
      const tomticketName = agent.tomticketName;
      const tomTicketCount = tomticketName ? agentChatCounts[tomticketName] || 0 : 0;
      
      if (agent.activeClients !== tomTicketCount) {
        console.log(`Updating ${agent.name} (TomTicket: ${tomticketName}): from ${agent.activeClients} to ${tomTicketCount}`);
        batch.update(agentRef, { 
          activeClients: tomTicketCount,
          lastInteractionTime: now
        });
        updatesMade++;
      }
    });

    if (updatesMade > 0) {
        await batch.commit();
        console.log(`Firestore batch commit successful. Updated ${updatesMade} agents.`);
    } else {
        console.log("No changes in active client counts. No Firestore update needed.");
    }
    
    return { success: true, message: "Sync successful" };
  } catch (error) {
    console.error("[CRITICAL] Failed to sync TomTicket data:", error);
    if (error instanceof Error) {
        return { success: false, message: error.message };
    }
    return { success: false, message: "An unknown error occurred during sync" };
  }
}
