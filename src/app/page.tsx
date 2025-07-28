
'use client';

import { useState, useEffect } from 'react';
import type { Agent, PauseLog } from '@/lib/types';
import { AgentDashboard } from '@/components/AgentDashboard';
import { ExportButton } from '@/components/ExportButton';
import ClientOnly from '@/components/ClientOnly';
import { Progress } from '@/components/ui/progress';
import { AnalysisPanel } from '@/components/AnalysisPanel';
import { getSupabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

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

function initializeAgents() {
    return initialAgentsData.map((agent, index) => ({
        id: `agent-${index + 1}`,
        name: agent.name,
        lastInteractionTime: new Date().toISOString(),
        activeClients: 0,
        isAvailable: true,
        totalClientsHandled: 0,
        avgTimePerClient: 0,
        isOnPause: false,
    }));
}


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
    // Check if Supabase keys are placeholders. If so, use mock data.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl || supabaseUrl === 'YOUR_SUPABASE_URL') {
        console.warn("Supabase keys not configured. Using initial mock data.");
        setAgents(initializeAgents());
        setIsLoading(false);
        return;
    }

    try {
      const supabase = getSupabase();
      
      const fetchInitialData = async () => {
        const { data, error } = await supabase.from('agents').select('*');
        if (error) {
          console.error("Error fetching agents:", error);
          toast({
            variant: 'destructive',
            title: 'Erro ao carregar dados',
            description: 'Não foi possível buscar os dados dos atendentes. Verifique a conexão com o Supabase.'
          })
          setAgents(initializeAgents()); // Fallback to initial data on error
        } else {
          setAgents(data || []);
        }
        setIsLoading(false);
      }

      fetchInitialData();
      
      const channel = supabase.channel('realtime-agents');

      channel
        .on<Agent>('postgres_changes', { event: '*', schema: 'public', table: 'agents' }, payload => {
          if (payload.eventType === 'UPDATE') {
            setAgents(prevAgents => 
              prevAgents.map(agent => 
                agent.id === payload.new.id ? payload.new : agent
              )
            );
          }
          // You can also handle INSERT and DELETE if needed
        })
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log('Connected to real-time agent updates!');
          }
          if (err) {
             console.error('Realtime subscription error:', err);
             setError('Falha na conexão em tempo real. Verifique as configurações do Supabase.');
          }
        });
        
      // Cleanup subscription on unmount
      return () => {
        supabase.removeChannel(channel);
      };
    } catch (e: any) {
        console.error(e.message);
        setError(e.message);
        setIsLoading(false);
    }
  }, []);
  
  const handleAddPauseLog = (log: Omit<PauseLog, 'id'>) => {
      setPauseLogs(prevLogs => [...prevLogs, {...log, id: `log-${Date.now()}`}]);
  };

  if (error) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
        <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold text-destructive mb-4">Erro de Configuração</h1>
            <p className="text-muted-foreground">{error}</p>
            <p className="text-muted-foreground mt-2">Por favor, verifique se as variáveis de ambiente `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` estão corretas no seu arquivo `.env`.</p>
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
             <p className="mt-4 text-muted-foreground">Carregando atendentes...</p>
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
