'use server';

import { db } from '@/lib/firebase';
import { AgentDocument, PauseLogDocument, DailyReport } from '@/lib/types';
import { collection, getDocs, doc, writeBatch, updateDoc, addDoc, query, where, orderBy, limit, setDoc, getDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { getActiveChats } from '@/lib/tomticket';

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


export async function syncTomTicketData() {
  console.log("Starting TomTicket data sync...");
  try {
    // Read the token securely on the server-side
    const apiToken = process.env.TOMTICKET_API_TOKEN;
    if (!apiToken) {
        console.error("[CRITICAL] TOMTICKET_API_TOKEN is not configured on the server.");
        throw new Error("Server is not configured with TomTicket API token.");
    }

    // 1. Fetch active chats from TomTicket, passing the token
    const tomTicketResponse = await getActiveChats(apiToken);
    console.log("TomTicket API Response:", JSON.stringify(tomTicketResponse, null, 2));

    if (!tomTicketResponse.success || !tomTicketResponse.data) {
      console.error("TomTicket API returned an error or no data:", tomTicketResponse.message);
      throw new Error(`TomTicket API did not return success: ${tomTicketResponse.message || 'No data property'}`);
    }

    const allChats = tomTicketResponse.data;

    // Filter for truly active chats (Aguardando or Em conversa)
    const activeChats = allChats.filter(chat => chat.situation === 1 || chat.situation === 2);
    console.log(`Found ${allChats.length} total chats. Found ${activeChats.length} active chats (situation 1 or 2).`);

    // 2. Count active chats per agent using their TomTicket name
    const agentChatCounts: { [key: string]: number } = {};
    for (const chat of activeChats) {
      // Defensive check: Ensure operator and operator.name exist
      const agentName = chat.operator?.name; 
      if (agentName) {
        if (!agentChatCounts[agentName]) {
          agentChatCounts[agentName] = 0;
        }
        agentChatCounts[agentName]++;
      }
    }
    console.log("Counted TomTicket agent chats:", agentChatCounts);

    // 3. Update Firestore
    const agentsCollection = collection(db, 'AtendimentoSAC');
    const agentsSnapshot = await getDocs(agentsCollection);
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    let updatesMade = 0;

    agentsSnapshot.docs.forEach(doc => {
      const agent = doc.data() as AgentDocument;
      const agentRef = doc.ref;
      
      const tomticketName = agent.tomticketName;
      // Get the count for the current agent, default to 0 if not in the list
      const tomTicketCount = tomticketName ? agentChatCounts[tomticketName] || 0 : 0;
      
      // Update only if the count is different
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
