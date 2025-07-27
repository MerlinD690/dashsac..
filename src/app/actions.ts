
'use server';

import { db } from '@/lib/firebase';
import { Agent, AgentDocument, PauseLog, PauseLogDocument } from '@/lib/types';
import { collection, doc, writeBatch, getDocs, query, where, Timestamp, updateDoc, addDoc, getDoc, setDoc } from 'firebase/firestore';

const agentsCollection = collection(db, 'agents');
const pauseLogsCollection = collection(db, 'pauseLogs');

export async function seedAgents(agents: Agent[]) {
  const batch = writeBatch(db);
  agents.forEach((agent) => {
    const agentDocRef = doc(agentsCollection, agent.id);
    const agentData: Omit<AgentDocument, 'id'> = {
      ...agent,
      lastInteractionTime: Timestamp.fromDate(new Date(agent.lastInteractionTime)),
    };
    if (agent.pauseStartTime) {
        agentData.pauseStartTime = Timestamp.fromDate(new Date(agent.pauseStartTime));
    }
    // Firestore does not accept undefined
    delete agentData.pauseStartTime;
    delete agentData.clientFeedback;
    
    batch.set(agentDocRef, agentData, { merge: true });
  });
  await batch.commit();
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
      // Use null to delete the field from the document
      updateData.pauseStartTime = null; 
    }
  }

  // Remove id from data to prevent it from being written to the document
  if ('id' in updateData) {
    delete updateData.id;
  }
  
  // When setting pauseStartTime to null, it might get filtered out if we just spread.
  // So we handle the update carefully.
  const finalUpdate: {[key: string]: any} = {};
  for(const key in updateData) {
      if(updateData[key] !== undefined) {
          finalUpdate[key] = updateData[key];
      }
  }

  await updateDoc(agentRef, finalUpdate);
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
