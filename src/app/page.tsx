'use client';

import { useState, useEffect } from 'react';
import type { Agent, PauseLog } from '@/lib/types';
import { AgentDashboard } from '@/components/AgentDashboard';
import { ExportButton } from '@/components/ExportButton';
import ClientOnly from '@/components/ClientOnly';
import { Progress } from '@/components/ui/progress';
import { AnalysisPanel } from '@/components/AnalysisPanel';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';

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
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const q = query(collection(db, "agents"));
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const agentsData: Agent[] = [];
        querySnapshot.forEach((doc) => {
          agentsData.push({ id: doc.id, ...doc.data() } as Agent);
        });
        setAgents(agentsData);
        setIsLoading(false);
      }, (err) => {
          console.error("Error fetching agents from Firestore:", err);
          toast({
            variant: 'destructive',
            title: 'Erro ao carregar dados',
            description: 'Não foi possível buscar os dados dos atendentes. Verifique a conexão com o Firebase.'
          });
          setError('Falha na conexão em tempo real com o Firestore.');
          setIsLoading(false);
      });
        
      // Cleanup subscription on unmount
      return () => unsubscribe();
    } catch (e: any) {
        console.error(e.message);
        setError(e.message);
        setIsLoading(false);
    }
  }, [toast]);
  
  const handleAddPauseLog = (log: Omit<PauseLog, 'id'>) => {
      // With Firestore, we don't need to manage pause logs in local state
      // as they are written directly to the DB by the server action
  };

  if (error) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
        <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold text-destructive mb-4">Erro de Conexão</h1>
            <p className="text-muted-foreground">{error}</p>
            <p className="text-muted-foreground mt-2">Por favor, verifique se a configuração do seu projeto Firebase está correta e se as regras de segurança do Firestore permitem leitura e escrita.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
             <OmoLogo />
            <h1 className="text-3xl font-bold font-headline tracking-tight text-blue-600">
              Atendimento Sac
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
             <p className="mt-4 text-muted-foreground">Carregando atendentes do Firestore...</p>
          </div>
        ) : (
          <ClientOnly>
            <AgentDashboard 
              agents={agents}
              onAddPauseLog={handleAddPauseLog}
            />
          </ClientOnly>
        )}
        
      </main>
    </div>
  );
}
