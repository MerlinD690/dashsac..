
'use server';

require('dotenv').config();

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
    const apiToken = process.env.TOMTICKET_API_TOKEN;

    if (!apiToken) {
        throw new Error('API token (TOMTICKET_API_TOKEN) is not configured in server environment.');
    }

    try {
        // 1. First call to get pagination info
        const initialUrl = `${TOMTICKET_API_URL}/chat/list?situation=2&page=1`;
        const initialResponse = await fetch(initialUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${apiToken}` },
            cache: 'no-store',
        });
        
        if (!initialResponse.ok) {
             const errorBody = await initialResponse.text();
             console.error('TomTicket API Error (Initial Call):', {
                status: initialResponse.status,
                statusText: initialResponse.statusText,
                body: errorBody
             });
             throw new Error(`Erro na API TomTicket: HTTP status ${initialResponse.status}`);
        }

        const initialData: TomTicketApiResponse = await initialResponse.json();
        
        if (!initialData.success || !initialData.data) {
             console.error('TomTicket API returned success=false on initial call', initialData.message);
             return []; // No data or error
        }

        let allChats: TomTicketChat[] = initialData.data;
        const totalPages = initialData.pages || 1;

        // 2. If there are more pages, fetch them concurrently
        if (totalPages > 1) {
            const pagePromises: Promise<TomTicketApiResponse>[] = [];
            for (let page = 2; page <= totalPages; page++) {
                const url = `${TOMTICKET_API_URL}/chat/list?situation=2&page=${page}`;
                const promise = fetch(url, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${apiToken}` },
                    cache: 'no-store',
                }).then(res => {
                    if (!res.ok) {
                        console.error(`Error fetching page ${page}:`, res.statusText);
                        return { success: false, data: [] }; // Return empty on error to not break Promise.all
                    }
                    return res.json() as Promise<TomTicketApiResponse>;
                }).catch(err => {
                    console.error(`Network error fetching page ${page}:`, err);
                    return { success: false, data: [] }; // Handle network errors as well
                });
                pagePromises.push(promise);
            }

            const pageResults = await Promise.all(pagePromises);
            
            for (const result of pageResults) {
                if (result.success && result.data) {
                    allChats = allChats.concat(result.data);
                }
            }
        }

        return allChats;

    } catch (error) {
        console.error('Failed to fetch chats from TomTicket:', error);
        if (error instanceof Error) {
            throw new Error(`Communication failure with TomTicket API: ${error.message}`);
        }
        throw new Error("An unexpected response was received from the server.");
    }
}


export async function syncTomTicketData() {
  console.log("SERVER_SYNC: Starting TomTicket data sync...");
  try {
    const activeChats = await getActiveChatsFromApi();
    
    console.log(`SERVER_SYNC: Found ${activeChats.length} active chats from API.`);

    const agentChatCounts: { [key: string]: number } = {};
    for (const chat of activeChats) {
      // Only count chats that have an assigned operator
      if (chat.operator && chat.operator.name) {
        const agentName = chat.operator.name; 
        agentChatCounts[agentName] = (agentChatCounts[agentName] || 0) + 1;
      }
    }
    console.log("SERVER_SYNC: Counted active TomTicket agent chats:", agentChatCounts);

    const agentsCollection = collection(db, 'AtendimentoSAC');
    const agentsSnapshot = await getDocs(agentsCollection);
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    
    const updateLog: string[] = [];

    // This map will store which agents from Firestore were found in the API response
    const activeAgentsFromApi = new Set(Object.keys(agentChatCounts));

    agentsSnapshot.docs.forEach(doc => {
      const agent = doc.data() as AgentDocument;
      const agentRef = doc.ref;
      const tomticketName = agent.tomticketName;
      
      const tomTicketCount = tomticketName ? agentChatCounts[tomticketName] || 0 : 0;
      
      const logMessage = `Updating ${agent.name} (TomTicket: ${tomticketName}): Firestore count ${agent.activeClients} -> API count ${tomTicketCount}`;
      updateLog.push(logMessage);

      batch.update(agentRef, { 
        activeClients: tomTicketCount,
        // Only update lastInteractionTime if they are currently active
        ...(tomTicketCount > 0 && { lastInteractionTime: now })
      });

      // Remove the agent from the set if they were found and updated
      if (tomticketName) {
        activeAgentsFromApi.delete(tomticketName);
      }
    });
    
    // Log agents from API that were not found in Firestore
    if (activeAgentsFromApi.size > 0) {
      console.warn("SERVER_SYNC: Agents from TomTicket API not found in Firestore seed data:", Array.from(activeAgentsFromApi));
      updateLog.push(`Warning: ${activeAgentsFromApi.size} agents from API response were not found in Firestore: ${Array.from(activeAgentsFromApi).join(', ')}`);
    }

    await batch.commit();
    console.log(`SERVER_SYNC: Firestore batch commit successful. Synced ${agentsSnapshot.docs.length} agents.`);
    
    return { 
        success: true, 
        message: "Sync successful",
        activeChats: activeChats.length,
        agentChatCounts: agentChatCounts,
        updatesMade: agentsSnapshot.docs.length,
        updateLog,
        dataSample: activeChats.slice(0, 5) 
    };
  } catch (error) {
    console.error("[CRITICAL] SERVER_SYNC: Failed to sync TomTicket data:", error);
    if (error instanceof Error) {
        return { success: false, message: error.message, dataSample: [] };
    }
    return { success: false, message: "An unknown error occurred during sync.", dataSample: [] };
  }
}

