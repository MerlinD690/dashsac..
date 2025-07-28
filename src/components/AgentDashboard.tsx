
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
import { Coffee, Minus, Plus, UserCheck, UserX } from 'lucide-react';

// Function to play a simple beep sound
function playNotificationSound() {
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


export function AgentDashboard({ agents, onUpdateAgent, onAddPauseLog }: { agents: Agent[]; onUpdateAgent: (agentId: string, updates: Partial<Agent>) => void; onAddPauseLog: (log: Omit<PauseLog, 'id'>) => void; }) {
  const { toast } = useToast();

  const handleUpdateClients = (agent: Agent, change: 1 | -1) => {
    const newCount = agent.activeClients + change;
    if (newCount < 0 || newCount > 5) return;

    const now = new Date();
    const lastInteraction = new Date(agent.lastInteractionTime);
    const timeDiffMinutes = (now.getTime() - lastInteraction.getTime()) / (1000 * 60);

    const updates: Partial<Agent> = {
      activeClients: newCount,
      lastInteractionTime: now.toISOString(),
    };
    if (change === 1) {
      const newTotalClientsHandled = agent.totalClientsHandled + 1;
      // Recalculate average time per client. This is a simplified logic.
      // It assumes the time since last interaction was for a single client if activeClients was > 0.
      // A more robust implementation might track each client session.
      const totalMinutesSoFar = agent.avgTimePerClient * agent.totalClientsHandled;
      const newAvgTimePerClient = (totalMinutesSoFar + timeDiffMinutes) / newTotalClientsHandled;
      
      updates.totalClientsHandled = newTotalClientsHandled;
      updates.avgTimePerClient = newAvgTimePerClient;
      playNotificationSound();
    }
    onUpdateAgent(agent.id, updates);
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
    onUpdateAgent(agent.id, { isAvailable: available });
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
        onAddPauseLog({
            agentName: agent.name,
            pauseStartTime: agent.pauseStartTime,
            pauseEndTime: now,
        });
        updates.pauseStartTime = undefined;
    }

    onUpdateAgent(agent.id, updates);
  };


  const getStatus = (agent: Agent): { text: string; icon: React.ReactNode; className: string } => {
    if (agent.isOnPause) return { text: 'Em Pausa', icon: <Coffee className="h-4 w-4" />, className: 'text-yellow-600' };
    if (agent.isAvailable) return { text: 'Disponível', icon: <UserCheck className="h-4 w-4" />, className: 'text-green-600' };
    return { text: 'Indisponível', icon: <UserX className="h-4 w-4" />, className: 'text-red-600' };
  };

  const sortedAgents = [...agents].sort((a, b) => {
    if (a.isAvailable !== b.isAvailable) {
      return a.isAvailable ? -1 : 1;
    }
    // Keep paused agents in their sorted name position
    if (a.isOnPause && !b.isOnPause) return a.name.localeCompare(b.name);
    if (!a.isOnPause && b.isOnPause) return a.name.localeCompare(b.name);
    
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
              return (
                <TableRow key={agent.id}>
                  <TableCell>
                    <div className="font-medium">
                      {agent.name}
                    </div>
                  </TableCell>
                  <TableCell>{new Date(agent.lastInteractionTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleUpdateClients(agent, -1)} disabled={!agent.isAvailable || agent.isOnPause || agent.activeClients === 0}>
                              <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-4 font-bold text-lg">{agent.activeClients}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleUpdateClients(agent, 1)} disabled={!agent.isAvailable || agent.isOnPause || agent.activeClients === 5}>
                              <Plus className="h-4 w-4" />
                          </Button>
                      </div>
                  </TableCell>
                  <TableCell>
                    <div className={`flex items-center gap-2 font-medium ${status.className}`}>
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
      </div>
    </TooltipProvider>
  );
}
