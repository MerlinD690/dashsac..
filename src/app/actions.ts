'use server';

import { db } from '@/lib/firebase';
import { AgentDocument, PauseLogDocument, DailyReport, TomTicketChat, TomTicketApiResponse } from '@/lib/types';
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

async function getActiveChatsFromApi(): Promise<TomTicketChat[]> {
    const TOMTICKET_API_URL = 'https://api.tomticket.com/v2.0';
    // Use the non-prefixed variable for server-side code.
    const apiToken = process.env.TOMTICKET_API_TOKEN;

    if (!apiToken) {
        throw new Error('API token (TOMTICKET_API_TOKEN) is not configured in server environment.');
    }

    let allChats: TomTicketChat[] = [];
    let page = 1;
    let keepFetching = true;

    while (keepFetching) {
        try {
            // Situation=2 means "Em conversa"
            const url = `${TOMTICKET_API_URL}/chat/list?situation=2&page=${page}`;
            console.log(`Fetching active chats from TomTicket... URL: ${url}`);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                },
                cache: 'no-store',
            });
            
            if (!response.ok) {
                const errorBody = await response.text();
                console.error('TomTicket API Error:', {
                    status: response.status,
                    statusText: response.statusText,
                    body: errorBody
                });
                throw new Error(`Erro na API TomTicket: HTTP status ${response.status}`);
            }

            const data: TomTicketApiResponse = await response.json();
            
            if (data.success && data.data && data.data.length > 0) {
                allChats = allChats.concat(data.data);
                // The API documentation indicates 'next_page' tells us if there's more data.
                if (data.next_page) {
                    page = data.next_page;
                    // Add a small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 250));
                } else {
                    keepFetching = false;
                }
            } else {
                keepFetching = false;
            }

        } catch (error) {
            console.error('Failed to fetch chats from TomTicket:', error);
            if (error instanceof Error) {
                throw new Error(`Communication failure with TomTicket API: ${error.message}`);
            }
            throw new Error("An unknown error occurred while fetching chats from TomTicket.");
        }
    }
    return allChats;
}


export async function syncTomTicketData() {
  console.log("SERVER_SYNC: Starting TomTicket data sync...");
  try {
    const activeChats = await getActiveChatsFromApi();
    
    console.log(`SERVER_SYNC: Found ${activeChats.length} active chats from API.`);

    const agentChatCounts: { [key: string]: number } = {};
    for (const chat of activeChats) {
      // Safe navigation: only count if operator and name exist.
      const agentName = chat.operator?.name; 
      if (agentName) {
        agentChatCounts[agentName] = (agentChatCounts[agentName] || 0) + 1;
      }
    }
    console.log("SERVER_SYNC: Counted active TomTicket agent chats:", agentChatCounts);

    const agentsCollection = collection(db, 'AtendimentoSAC');
    const agentsSnapshot = await getDocs(agentsCollection);
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    let updatesMade = 0;
    
    const updateLog: string[] = [];

    // Reset all agents' client counts to 0 before applying new counts
    agentsSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { activeClients: 0 });
    });

    // Apply the new counts from the API
    agentsSnapshot.docs.forEach(doc => {
      const agent = doc.data() as AgentDocument;
      const agentRef = doc.ref;
      const tomticketName = agent.tomticketName;
      
      const tomTicketCount = tomticketName ? agentChatCounts[tomticketName] || 0 : 0;
      
      // Update even if the count is the same (0), to ensure reset is committed.
      const logMessage = `Updating ${agent.name} (TomTicket: ${tomticketName}): Firestore count ${agent.activeClients} -> API count ${tomTicketCount}`;
      updateLog.push(logMessage);

      batch.update(agentRef, { 
        activeClients: tomTicketCount,
        // Only update interaction time if they are active
        ...(tomTicketCount > 0 && { lastInteractionTime: now })
      });
      updatesMade++;
    });

    if (updatesMade > 0) {
        await batch.commit();
        console.log(`SERVER_SYNC: Firestore batch commit successful. Updated ${updatesMade} agents.`);
    } else {
        // This case might happen if there are no agents in Firestore.
        // We still need to commit the reset batch.
        await batch.commit();
        console.log("SERVER_SYNC: No agents to update, but reset batch committed.");
    }
    
    return { 
        success: true, 
        message: "Sync successful",
        activeChats: activeChats.length,
        agentChatCounts: agentChatCounts,
        updatesMade,
        updateLog,
        dataSample: activeChats.slice(0, 5) 
    };
  } catch (error) {
    console.error("[CRITICAL] SERVER_SYNC: Failed to sync TomTicket data:", error);
    if (error instanceof Error) {
        return { success: false, message: error.message, dataSample: [] };
    }
    return { success: false, message: "An unknown error occurred during sync", dataSample: [] };
  }
}
