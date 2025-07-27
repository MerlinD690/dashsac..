
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
import { Progress } from '@/components/ui/progress';

const initialAgents: Agent[] = [
    { id: 'agent-1', name: 'Beatriz', lastInteractionTime: new Date().toISOString(), activeClients: 0, isAvailable: true, totalClientsHandled: 0, avgTimePerClient: 0, isOnPause: false },
    { id: 'agent-2', name: 'Valquiria', lastInteractionTime: new Date().toISOString(), activeClients: 0, isAvailable: true, totalClientsHandled: 0, avgTimePerClient: 0, isOnPause: false },
    { id: 'agent-3', name: 'Larissa', lastInteractionTime: new Date().toISOString(), activeClients: 0, isAvailable: true, totalClientsHandled: 0, avgTimePerClient: 0, isOnPause: false },
    { id: 'agent-4', name: 'Sophia', lastInteractionTime: new Date().toISOString(), activeClients: 0, isAvailable: true, totalClientsHandled: 0, avgTimePerClient: 0, isOnPause: false },
    { id: 'agent-5', name: 'Lays', lastInteractionTime: new Date().toISOString(), activeClients: 0, isAvailable: true, totalClientsHandled: 0, avgTimePerClient: 0, isOnPause: false },
    { id: 'agent-6', name: 'Flaviane', lastInteractionTime: new Date().toISOString(), activeClients: 0, isAvailable: true, totalClientsHandled: 0, avgTimePerClient: 0, isOnPause: false },
    { id: 'agent-7', name: 'Juliana', lastInteractionTime: new Date().toISOString(), activeClients: 0, isAvailable: true, totalClientsHandled: 0, avgTimePerClient: 0, isOnPause: false },
    { id: 'agent-8', name: 'Laura', lastInteractionTime: new Date().toISOString(), activeClients: 0, isAvailable: true, totalClientsHandled: 0, avgTimePerClient: 0, isOnPause: false },
    { id: 'agent-9', name: 'Camila', lastInteractionTime: new Date().toISOString(), activeClients: 0, isAvailable: true, totalClientsHandled: 0, avgTimePerClient: 0, isOnPause: false },
    { id: 'agent-10', name: 'Giovanna', lastInteractionTime: new Date().toISOString(), activeClients: 0, isAvailable: true, totalClientsHandled: 0, avgTimePerClient: 0, isOnPause: false },
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
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // We run this to seed the database
    const doSeed = async () => {
        await seedAgents(initialAgents);
    }
    doSeed();
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
      if(agentsData.length > 0) {
          setIsLoading(false);
      }
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

  useEffect(() => {
    if (isLoading) {
      const timer = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) {
            clearInterval(timer);
            return 95;
          }
          return prev + 5;
        });
      }, 100);
      return () => clearInterval(timer);
    } else {
        setProgress(100);
    }
  }, [isLoading]);

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
          <div className="space-y-4 flex flex-col items-center justify-center h-64">
             <div className="w-1/2 text-center">
                <p className="mb-2">Carregando atendentes...</p>
                <Progress value={progress} />
             </div>
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
