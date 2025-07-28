
'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { Agent, PauseLog } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Coffee, Minus, Plus, UserCheck, UserX } from 'lucide-react';
import RealTimeClock from './RealTimeClock';
import ClientOnly from './ClientOnly';
import { addPauseLog, updateAgent } from '@/app/actions';
import { useState } from 'react';

// Function to play a simple beep sound
function playNotificationSound() {
    if (typeof window === 'undefined' || !window.AudioContext) return;
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (!audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const now = audioContext.currentTime;

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, now);
    oscillator.frequency.linearRampToValueAtTime(880, now + 0.1);

    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + 0.3);
}

const findNextBestAgent = (agents: Agent[]): string | null => {
  const availableAgents = agents
    .filter(agent => agent.isAvailable && !agent.isOnPause)
    .sort((a, b) => {
      if (a.activeClients < b.activeClients) return -1;
      if (a.activeClients > b.activeClients) return 1;
      const timeA = new Date(a.lastInteractionTime).getTime();
      const timeB = new Date(b.lastInteractionTime).getTime();
      return timeA - timeB;
    });

  return availableAgents.length > 0 ? availableAgents[0].id : null;
};

// Check if we are in demo mode (no Supabase keys)
const isDemoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === 'YOUR_SUPABASE_URL';

export function AgentDashboard({ agents: initialAgents, onAddPauseLog }: { agents: Agent[]; onAddPauseLog: (log: Omit<PauseLog, 'id'>) => void; }) {
  const [localAgents, setLocalAgents] = useState(initialAgents);
  const { toast } = useToast();
  
  const agents = isDemoMode ? localAgents : initialAgents;
  const setAgents = isDemoMode ? setLocalAgents : () => {};

  const nextAgentId = findNextBestAgent(agents);

  const handleUpdate = (agentId: string, updates: Partial<Agent>) => {
      if (isDemoMode) {
          setAgents(prev => prev.map(a => a.id === agentId ? {...a, ...updates} : a));
          return;
      }

      updateAgent(agentId, updates).catch(error => {
          console.error(`Failed to update agent ${agentId}`, error);
          toast({ variant: 'destructive', title: 'Erro de Rede', description: 'Não foi possível atualizar o atendente.' });
      });
  };

  const handleAddLog = (log: Omit<PauseLog, 'id'>) => {
    onAddPauseLog(log);
    if (!isDemoMode) {
      addPauseLog(log).catch(error => {
          console.error("Failed to add pause log", error);
          toast({ variant: 'destructive', title: 'Erro de Rede', description: 'Não foi possível registrar a pausa.' });
      });
    }
  }

  const handleUpdateClients = (agent: Agent, change: 1 | -1) => {
    const newCount = agent.activeClients + change;
    if (newCount < 0 || newCount > 5) return;

    const now = new Date();
    
    const updates: Partial<Agent> = {
      activeClients: newCount,
      lastInteractionTime: now.toISOString(),
    };
    if (change === 1) {
       const lastInteraction = new Date(agent.lastInteractionTime);
       const timeDiffMinutes = (now.getTime() - lastInteraction.getTime()) / (1000 * 60);

      const newTotalClientsHandled = agent.totalClientsHandled + 1;
      const totalMinutesSoFar = agent.avgTimePerClient * agent.totalClientsHandled;
      const newAvgTimePerClient = (totalMinutesSoFar + timeDiffMinutes) / newTotalClientsHandled;
      
      updates.totalClientsHandled = newTotalClientsHandled;
      updates.avgTimePerClient = newAvgTimePerClient;
      playNotificationSound();
    }
    handleUpdate(agent.id, updates);
  };

  const handleToggleAvailability = (agent: Agent, available: boolean) => {
    if (!available && agent.activeClients > 0) {
      toast({
        variant: 'destructive',
        title: 'Ação não permitida',
        description: 'Não é possível desativar um atendente com clientes ativos.',
      });
      return;
    }
    handleUpdate(agent.id, { isAvailable: available });
  };

  const handleTogglePause = (agent: Agent) => {
    if (agent.activeClients > 0) {
      toast({
        variant: 'destructive',
        title: 'Ação não permitida',
        description: 'Não é possível pausar um atendente com clientes ativos.',
      });
      return;
    }

    const isOnPause = !agent.isOnPause;
    const now = new Date().toISOString();
    const updates: Partial<Agent> = { isOnPause, lastInteractionTime: now };

    if (isOnPause) {
        updates.pauseStartTime = now;
    } else if(agent.pauseStartTime) {
        const pauseLog = {
            agentName: agent.name,
            pauseStartTime: agent.pauseStartTime,
            pauseEndTime: now,
        };
        handleAddLog(pauseLog);
        updates.pauseStartTime = undefined;
    }

    handleUpdate(agent.id, updates);
  };


  const getStatus = (agent: Agent): { text: string; icon: React.ReactNode; className: string } => {
    if (agent.isOnPause) return { text: 'Em Pausa', icon: <Coffee className="h-4 w-4" />, className: 'text-yellow-600' };
    if (agent.isAvailable) return { text: 'Disponível', icon: <UserCheck className="h-4 w-4" />, className: 'text-green-600' };
    return { text: 'Indisponível', icon: <UserX className="h-4 w-4" />, className: 'text-red-600' };
  };

  const sortedAgents = [...agents].sort((a, b) => {
    return a.name.localeCompare(b.name);
  });

  return (
    <TooltipProvider>
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Atendente</TableHead>
              <TableHead>Última Interação</TableHead>
              <TableHead className="text-center">Clientes Ativos</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Pausa</TableHead>
              <TableHead className="text-right">Disponibilidade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAgents.map((agent) => {
              const status = getStatus(agent);
              const isNextAgent = agent.id === nextAgentId;
              return (
                <TableRow key={agent.id} className={cn(isNextAgent && "bg-primary/20 hover:bg-primary/30")}>
                  <TableCell>
                    <div className={cn("font-medium", isNextAgent && "font-bold")}>
                      {agent.name}
                    </div>
                  </TableCell>
                  <TableCell className={cn(isNextAgent && "font-bold")}>{new Date(agent.lastInteractionTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                          <Button variant="ghost" size="icon" className={cn("h-6 w-6", isNextAgent && 'hover:bg-primary/40 font-bold')} onClick={() => handleUpdateClients(agent, -1)} disabled={!agent.isAvailable || agent.isOnPause || agent.activeClients === 0}>
                              <Minus className="h-4 w-4" />
                          </Button>
                          <span className={cn("w-4 text-lg", isNextAgent ? "font-bold" : "font-medium")}>{agent.activeClients}</span>
                          <Button variant="ghost" size="icon" className={cn("h-6 w-6", isNextAgent && 'hover:bg-primary/40 font-bold')} onClick={() => handleUpdateClients(agent, 1)} disabled={!agent.isAvailable || agent.isOnPause || agent.activeClients === 5}>
                              <Plus className="h-4 w-4" />
                          </Button>
                      </div>
                  </TableCell>
                  <TableCell>
                    <div className={cn('flex items-center gap-2 font-medium', status.className)}>
                      {status.icon}
                      <span>{status.text}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={() => handleTogglePause(agent)} disabled={!agent.isAvailable || agent.activeClients > 0}>
                          <Coffee className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{agent.isOnPause ? 'Finalizar Pausa' : 'Iniciar Pausa'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="text-right">
                    <Switch
                      checked={agent.isAvailable}
                      onCheckedChange={(checked) => handleToggleAvailability(agent, checked)}
                      disabled={agent.activeClients > 0 || agent.isOnPause}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="flex items-center justify-end p-2 border-t">
            <ClientOnly>
                <RealTimeClock />
            </ClientOnly>
        </div>
      </div>
    </TooltipProvider>
  );
}
