
'use server';

import { db } from '@/lib/firebase';
import { Agent, AgentDocument, PauseLog, PauseLogDocument, DailyReport } from '@/lib/types';
import { collection, doc, writeBatch, getDocs, query, where, Timestamp, updateDoc, addDoc, serverTimestamp, deleteField, getDoc, collectionGroup, deleteDoc, documentId, orderBy, limit } from 'firebase/firestore';
import { format } from 'date-fns';

const agentsCollection = collection(db, 'agents');
const pauseLogsCollection = collection(db, 'pauseLogs');
const dailyReportsCollection = collection(db, 'dailyReports');


export async function clearAndSeedAgents(agents: Agent[]) {
  // Clear existing agents
  const existingAgentsSnapshot = await getDocs(agentsCollection);
  if (!existingAgentsSnapshot.empty) {
    const deleteBatch = writeBatch(db);
    existingAgentsSnapshot.docs.forEach(doc => {
      deleteBatch.delete(doc.ref);
    });
    await deleteBatch.commit();
    console.log("Existing agents cleared.");
  }
  
  // Seed new agents
  const seedBatch = writeBatch(db);
  agents.forEach((agent) => {
    const agentDocRef = doc(agentsCollection, agent.id);
    const agentData: Omit<AgentDocument, 'id' | 'lastInteractionTime'> & { lastInteractionTime: any } = {
      ...agent,
      lastInteractionTime: Timestamp.fromDate(new Date(agent.lastInteractionTime)),
    };
    
    if (agentData.pauseStartTime === undefined) {
      delete agentData.pauseStartTime;
    }
     if (agentData.clientFeedback === undefined) {
      delete agentData.clientFeedback;
    }

    seedBatch.set(agentDocRef, agentData);
  });
  await seedBatch.commit();
  console.log("New agents seeded.");
}


export async function updateAgent(agentId: string, data: Partial<Agent>) {
  const agentRef = doc(db, 'agents', agentId);
  
  const updateData: { [key: string]: any } = { ...data };

  if (data.lastInteractionTime) {
    updateData.lastInteractionTime = Timestamp.fromDate(new Date(data.lastInteractionTime));
  }
  
  if (data.hasOwnProperty('pauseStartTime')) {
    if (data.pauseStartTime) {
      updateData.pauseStartTime = Timestamp.fromDate(new Date(data.pauseStartTime));
    } else {
      updateData.pauseStartTime = deleteField();
    }
  }

  if ('id' in updateData) {
    delete updateData.id;
  }
  
  await updateDoc(agentRef, updateData);
}

export async function addPauseLog(log: Omit<PauseLog, 'id'>) {
    const logDocument: Omit<PauseLogDocument, 'id'> = {
        ...log,
        pauseStartTime: Timestamp.fromDate(new Date(log.pauseStartTime)),
        pauseEndTime: Timestamp.fromDate(new Date(log.pauseEndTime)),
    }
  await addDoc(pauseLogsCollection, logDocument);
}

export async function getPauseLogsInRange(startDate: Date, endDate: Date): Promise<PauseLog[]> {
    const q = query(
        pauseLogsCollection, 
        where('pauseStartTime', '>=', Timestamp.fromDate(startDate)),
        where('pauseStartTime', '<=', Timestamp.fromDate(endDate))
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
        const data = doc.data() as PauseLogDocument;
        return {
            id: doc.id,
            ...data,
            pauseStartTime: data.pauseStartTime.toDate().toISOString(),
            pauseEndTime: data.pauseEndTime.toDate().toISOString(),
        }
    });
}

export async function addDailyReport(report: Omit<DailyReport, 'date'>) {
    const today = format(new Date(), 'yyyy-MM-dd');
    const reportWithDate: DailyReport = {
        ...report,
        date: today,
    };
    const reportRef = doc(dailyReportsCollection, today);
    await writeBatch(db).set(reportRef, reportWithDate).commit();
}

export async function getDailyReports(days = 30): Promise<DailyReport[]> {
    const q = query(dailyReportsCollection, orderBy('date', 'desc'), limit(days));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as DailyReport);
}
