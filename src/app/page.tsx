
'use client';

import { useState, useEffect } from 'react';
import { onSnapshot, collection, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Agent, AgentDocument, PauseLog, PauseLogDocument } from '@/lib/types';
import { seedAgents } from './actions';
import { AgentDashboard } from '@/components/AgentDashboard';
import { Assistant } from '@/components/Assistant';
import { ExportButton } from '@/components/ExportButton';
import ClientOnly from '@/components/ClientOnly';
import RealTimeClock from '@/components/RealTimeClock';
import { Skeleton } from '@/components/ui/skeleton';

const initialAgents: Agent[] = [
  { id: 'agent-1', name: 'Ana Silva', lastInteractionTime: '2023-10-26T10:00:00Z', activeClients: 2, isAvailable: true, totalClientsHandled: 15, avgTimePerClient: 12, clientFeedback: 'Muito atenciosa', isOnPause: false },
  { id: 'agent-2', name: 'Bruno Costa', lastInteractionTime: '2023-10-26T10:15:00Z', activeClients: 1, isAvailable: true, totalClientsHandled: 10, avgTimePerClient: 15, isOnPause: false },
  { id: 'agent-3', name: 'Carla Dias', lastInteractionTime: '2023-10-26T09:50:00Z', activeClients: 0, isAvailable: false, totalClientsHandled: 20, avgTimePerClient: 10, isOnPause: false },
  { id: 'agent-4', name: 'Daniel Alves', lastInteractionTime: '2023-10-26T10:20:00Z', activeClients: 3, isAvailable: true, totalClientsHandled: 5, avgTimePerClient: 18, clientFeedback: 'Poderia ser mais rápido', isOnPause: true, pauseStartTime: new Date(Date.now() - 5 * 60000).toISOString() },
  { id: 'agent-5', name: 'Elisa Ferreira', lastInteractionTime: '2023-10-26T10:05:00Z', activeClients: 0, isAvailable: true, totalClientsHandled: 25, avgTimePerClient: 8, isOnPause: false },
];

function OmoLogo() {
  return (
    <svg width="40" height="40" viewBox="0 0 125 125" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M62.5 125C97.0178 125 125 97.0178 125 62.5C125 27.9822 97.0178 0 62.5 0C27.9822 0 0 27.9822 0 62.5C0 97.0178 27.9822 125 62.5 125Z" fill="url(#paint0_linear_1_2)"/>
      <defs>
        <linearGradient id="paint0_linear_1_2" x1="62.5" y1="0" x2="62.5" y2="125" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6"/>
          <stop offset="1" stopColor="#9333EA"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [pauseLogs, setPauseLogs] = useState<PauseLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    seedAgents(initialAgents);
  }, []);

  useEffect(() => {
    const unsubscribeAgents = onSnapshot(collection(db, 'agents'), (snapshot) => {
      const agentsData = snapshot.docs.map(doc => {
        const data = doc.data() as AgentDocument;
        return {
          id: doc.id,
          ...data,
          lastInteractionTime: data.lastInteractionTime.toDate().toISOString(),
          pauseStartTime: data.pauseStartTime?.toDate().toISOString(),
        } as Agent;
      }).sort((a,b) => a.name.localeCompare(b.name));
      setAgents(agentsData);
      setIsLoading(false);
    });

    const unsubscribePauseLogs = onSnapshot(collection(db, 'pauseLogs'), (snapshot) => {
      const logsData = snapshot.docs.map(doc => {
        const data = doc.data() as PauseLogDocument;
        return {
            id: doc.id,
            ...data,
            pauseStartTime: data.pauseStartTime.toDate().toISOString(),
            pauseEndTime: data.pauseEndTime.toDate().toISOString(),
        } as PauseLog;
      });
      setPauseLogs(logsData);
    });

    return () => {
      unsubscribeAgents();
      unsubscribePauseLogs();
    };
  }, []);

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 relative">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
             <OmoLogo />
            <h1 className="text-3xl font-bold font-headline tracking-tight">
              OmoFlow Dashboard
            </h1>
          </div>
          <ExportButton />
        </header>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <AgentDashboard agents={agents} />
        )}
        
        <ClientOnly>
          <Assistant agents={agents} pauseLogs={pauseLogs} />
        </ClientOnly>

        <footer className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-0">
            <ClientOnly>
                <RealTimeClock />
            </ClientOnly>
        </footer>
      </main>
    </div>
  );
}
