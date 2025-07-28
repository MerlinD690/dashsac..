
'use client';

import { useState, useEffect } from 'react';
import type { Agent, PauseLog } from '@/lib/types';
import { AgentDashboard } from '@/components/AgentDashboard';
import { ExportButton } from '@/components/ExportButton';
import ClientOnly from '@/components/ClientOnly';
import RealTimeClock from '@/components/RealTimeClock';
import { Progress } from '@/components/ui/progress';
import { AnalysisPanel } from '@/components/AnalysisPanel';

const initialAgentsData: Omit<Agent, 'id' | 'lastInteractionTime' | 'activeClients' | 'isAvailable' | 'totalClientsHandled' | 'avgTimePerClient' | 'isOnPause'>[] = [
    { name: 'Beatriz' },
    { name: 'Valquiria' },
    { name: 'Larissa' },
    { name: 'Sophia' },
    { name: 'Lays' },
    { name: 'Flaviane' },
    { name: 'Juliana' },
    { name: 'Laura' },
    { name: 'Camila' },
    { name: 'Giovanna' },
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
    const initializedAgents = initialAgentsData.map((agent, index) => ({
      id: `agent-${index + 1}`,
      name: agent.name,
      lastInteractionTime: new Date().toISOString(),
      activeClients: 0,
      isAvailable: true,
      totalClientsHandled: 0,
      avgTimePerClient: 0,
      isOnPause: false,
    }));
    setAgents(initializedAgents);
    setIsLoading(false);
  }, []);
  
  const handleUpdateAgent = (agentId: string, updates: Partial<Agent>) => {
    setAgents(prevAgents => prevAgents.map(agent => 
      agent.id === agentId ? { ...agent, ...updates } : agent
    ));
  };
  
  const handleAddPauseLog = (log: Omit<PauseLog, 'id'>) => {
      setPauseLogs(prevLogs => [...prevLogs, {...log, id: `log-${Date.now()}`}]);
  };


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
          <div className="flex items-center gap-2">
            <AnalysisPanel agents={agents} pauseLogs={pauseLogs} />
            <ExportButton agents={agents} pauseLogs={pauseLogs} />
          </div>
        </header>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center flex-1">
             <Progress value={33} className="w-1/2" />
             <p className="mt-4 text-muted-foreground">Carregando atendentes...</p>
          </div>
        ) : (
          <ClientOnly>
            <AgentDashboard 
              agents={agents}
              onUpdateAgent={handleUpdateAgent}
              onAddPauseLog={handleAddPauseLog}
            />
          </ClientOnly>
        )}
        
        <footer className="fixed bottom-4 right-8 md:bottom-8 md:right-10 z-0">
            <ClientOnly>
                <RealTimeClock />
            </ClientOnly>
        </footer>
      </main>
    </div>
  );
}
