
'use server';

// NOTE: This file is not currently used because the app is running in client-side only mode.
// Firestore API needs to be enabled in the project for these functions to work.

import { db } from '@/lib/firebase';
import { Agent, AgentDocument, PauseLog, PauseLogDocument } from '@/lib/types';
import { collection, doc, writeBatch, getDocs, query, where, Timestamp, updateDoc, addDoc, serverTimestamp, deleteField, getDoc, collectionGroup, deleteDoc, documentId } from 'firebase/firestore';

const agentsCollection = collection(db, 'agents');
const pauseLogsCollection = collection(db, 'pauseLogs');

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
    
    // Firestore does not accept undefined, so we must remove the optional fields if they are not present
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

  // Convert ISO strings back to Timestamps for Firestore
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

  // Remove id from data to prevent it from being written to the document
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
