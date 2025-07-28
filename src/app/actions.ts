
'use server';

import { db } from '@/lib/firebase';
import { AgentDocument, PauseLogDocument, DailyReport, TomTicketChat } from '@/lib/types';
import { collection, getDocs, doc, writeBatch, updateDoc, addDoc, query, where, orderBy, limit, setDoc, getDoc } from 'firebase/firestore';
import { format, subMinutes } from 'date-fns';

// Tipos locais para a resposta da API TomTicket
interface TomTicketOperator {
    id: string;
    name: string;
}

interface TomTicketApiResponse {
  success: boolean;
  data: TomTicketChat[];
  message?: string; // Adicionado para capturar a mensagem de erro
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


async function getActiveChats(): Promise<TomTicketChat[]> {
    const TOMTICKET_API_URL = 'https://api.tomticket.com/v2.0';
    const apiToken = process.env.TOMTICKET_API_TOKEN;

    if (!apiToken) {
        console.error('API token (TOMTICKET_API_TOKEN) is not available in server environment.');
        throw new Error('API token (TOMTICKET_API_TOKEN) is not available in server environment.');
    }

    try {
        const url = `${TOMTICKET_API_URL}/chat/list`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
            },
            cache: 'no-store',
        });
        
        const data: TomTicketApiResponse = await response.json();

        if (!response.ok) {
            console.error('TomTicket API Error:', {
                status: response.status,
                statusText: response.statusText,
                body: data
            });
            const errorMessage = data.message || `HTTP error! status: ${response.status}`;
            throw new Error(`Erro na API TomTicket: ${errorMessage}`);
        }

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
  console.log("SERVER_SYNC: Starting TomTicket data sync...");
  try {
    const allChats = await getActiveChats();
    
    // Logic changed: An active chat is one that has an operator assigned.
    // We are no longer filtering by situation, as the values were uncertain.
    const activeChats = allChats.filter(chat => chat.operator && chat.operator.name);
    
    console.log(`SERVER_SYNC: Found ${allChats.length} total chats from API. Found ${activeChats.length} assigned chats.`);

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
    // New Detailed Log
    console.log("SERVER_SYNC: Counted active TomTicket agent chats:", agentChatCounts);

    const agentsCollection = collection(db, 'AtendimentoSAC');
    const agentsSnapshot = await getDocs(agentsCollection);
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    let updatesMade = 0;
    
    const updateLog: string[] = [];

    agentsSnapshot.docs.forEach(doc => {
      const agent = doc.data() as AgentDocument;
      const agentRef = doc.ref;
      
      const tomticketName = agent.tomticketName;
      // New Verification Log
      console.log(`SERVER_SYNC: Checking Firestore agent '${agent.name}' with tomticketName: '${tomticketName}'`);

      const tomTicketCount = tomticketName ? agentChatCounts[tomticketName] || 0 : 0;
      
      if (agent.activeClients !== tomTicketCount) {
        const logMessage = `Updating ${agent.name} (TomTicket: ${tomticketName}): Firestore count ${agent.activeClients} -> API count ${tomTicketCount}`;
        console.log(`SERVER_SYNC: ${logMessage}`);
        updateLog.push(logMessage);

        batch.update(agentRef, { 
          activeClients: tomTicketCount,
          lastInteractionTime: now
        });
        updatesMade++;
      }
    });

    if (updatesMade > 0) {
        await batch.commit();
        console.log(`SERVER_SYNC: Firestore batch commit successful. Updated ${updatesMade} agents.`);
    } else {
        console.log("SERVER_SYNC: No changes in active client counts. No Firestore update needed.");
    }
    
    return { 
        success: true, 
        message: "Sync successful",
        totalChats: allChats.length,
        activeChats: activeChats.length,
        agentChatCounts,
        updatesMade,
        updateLog,
        dataSample: allChats.slice(0, 5) 
    };
  } catch (error) {
    console.error("[CRITICAL] SERVER_SYNC: Failed to sync TomTicket data:", error);
    if (error instanceof Error) {
        return { success: false, message: error.message, dataSample: [] };
    }
    return { success: false, message: "An unknown error occurred during sync", dataSample: [] };
  }
}
