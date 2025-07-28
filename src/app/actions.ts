
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
        throw new Error('API token (TOMTICKET_API_TOKEN) is not available in server environment.');
    }

    try {
        // Removendo completamente o parâmetro de data para evitar o erro "Invalid date"
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
  console.log("Starting TomTicket data sync...");
  try {
    const allChats = await getActiveChats();
    
    // Filtramos aqui para garantir que temos os chats corretos
    // Situação 1 = Aguardando, 2 = Em conversa
    const activeChats = allChats.filter(chat => chat.situation === 1 || chat.situation === 2);
    console.log(`Found ${allChats.length} total chats from API. Found ${activeChats.length} active chats (situation 1 or 2).`);

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
      // O nome no TomTicket pode não ser exatamente igual, então vamos ser flexíveis
      const tomTicketCount = tomticketName ? agentChatCounts[tomticketName] || 0 : 0;
      
      // Apenas atualizamos se a contagem for diferente
      if (agent.activeClients !== tomTicketCount) {
        console.log(`Updating ${agent.name} (TomTicket: ${tomticketName}): from ${agent.activeClients} to ${tomTicketCount}`);
        batch.update(agentRef, { 
          activeClients: tomTicketCount,
          lastInteractionTime: now // Atualiza o tempo de interação em qualquer mudança
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
