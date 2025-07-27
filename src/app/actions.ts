
'use server';

import { db } from '@/lib/firebase';
import { Agent, AgentDocument, PauseLog, PauseLogDocument } from '@/lib/types';
import { collection, doc, writeBatch, getDocs, query, where, Timestamp, updateDoc, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';

const agentsCollection = collection(db, 'agents');
const pauseLogsCollection = collection(db, 'pauseLogs');

export async function seedAgents(agents: Agent[]) {
  const batch = writeBatch(db);
  const querySnapshot = await getDocs(agentsCollection);

  // Delete existing agents to ensure a fresh seed
  querySnapshot.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  // Add new agents in a new batch
  const newBatch = writeBatch(db);
  agents.forEach((agent) => {
    const agentDocRef = doc(agentsCollection, agent.id);
    const agentData: Omit<AgentDocument, 'id'> = {
      ...agent,
      lastInteractionTime: Timestamp.fromDate(new Date(agent.lastInteractionTime)),
    };
    if (agent.pauseStartTime) {
        agentData.pauseStartTime = Timestamp.fromDate(new Date(agent.pauseStartTime));
    } else {
      delete agentData.pauseStartTime;
    }
    newBatch.set(agentDocRef, agentData);
  });
  await newBatch.commit();
  console.log('Database seeded with initial agents.');
}


export async function updateAgent(agentId: string, data: Partial<Agent>) {
  const agentRef = doc(db, 'agents', agentId);
  
  const updateData: Partial<AgentDocument> = { ...data };
  if(data.lastInteractionTime) {
    updateData.lastInteractionTime = Timestamp.fromDate(new Date(data.lastInteractionTime))
  }
   if (data.pauseStartTime === null) {
    // This is a special case to remove the field
    // @ts-ignore
    updateData.pauseStartTime = null;
  } else if (data.pauseStartTime) {
    updateData.pauseStartTime = Timestamp.fromDate(new Date(data.pauseStartTime));
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
