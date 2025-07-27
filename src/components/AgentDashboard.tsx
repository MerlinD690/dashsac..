
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
import { useToast } from '@/hooks/use-toast';
import { Agent, PauseLog } from '@/lib/types';
import { Coffee, Minus, Plus, UserCheck, UserX } from 'lucide-react';

interface AgentDashboardProps {
  agents: Agent[];
  onUpdateAgent: (agentId: string, updates: Partial<Agent>) => void;
  onAddPauseLog: (log: Omit<PauseLog, 'id'>) => void;
}

export function AgentDashboard({ agents, onUpdateAgent, onAddPauseLog }: AgentDashboardProps) {
  const { toast } = useToast();

  const handleUpdateClients = (agent: Agent, change: 1 | -1) => {
    const newCount = agent.activeClients + change;
    if (newCount < 0 || newCount > 5) return;

    const updates: Partial<Agent> = {
      activeClients: newCount,
      lastInteractionTime: new Date().toISOString(),
    };
    if (change === 1) {
      updates.totalClientsHandled = agent.totalClientsHandled + 1;
      // Simple avg time logic, can be improved
      updates.avgTimePerClient = (agent.avgTimePerClient * agent.totalClientsHandled + 15) / (agent.totalClientsHandled + 1);
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
    const updates: Partial<Agent> = { isOnPause };

    if (isOnPause) {
        updates.pauseStartTime = new Date().toISOString();
    } else if(agent.pauseStartTime) {
        onAddPauseLog({
            agentName: agent.name,
            pauseStartTime: agent.pauseStartTime,
            pauseEndTime: new Date().toISOString(),
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
    if (a.isOnPause !== b.isOnPause) {
        return a.isOnPause ? 1 : -1;
    }
    if (a.isAvailable === b.isAvailable) {
        if(!a.isAvailable) return 1; // Both unavailable, no change
    }
    return a.name.localeCompare(b.name);
  });

  return (
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
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleUpdateClients(agent, -1)} disabled={!agent.isAvailable || agent.activeClients === 0}>
                            <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-4 font-bold text-lg">{agent.activeClients}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleUpdateClients(agent, 1)} disabled={!agent.isAvailable || agent.activeClients === 5}>
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
                  <Button variant="outline" size="icon" onClick={() => handleTogglePause(agent)} disabled={!agent.isAvailable || agent.activeClients > 0}>
                    <Coffee className="h-4 w-4" />
                  </Button>
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
  );
}
