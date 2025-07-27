
'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Agent, PauseLog } from '@/lib/types';
import { Circle, Coffee, Minus, Plus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AgentDashboardProps {
  agents: Agent[];
  onUpdateAgent: (agentId: string, updates: Partial<Agent>) => void;
  onAddPauseLog: (log: Omit<PauseLog, 'id'>) => void;
}

const getNextAgent = (agents: Agent[]): Agent | null => {
  const availableAgents = agents
    .filter(a => a.isAvailable && !a.isOnPause)
    .sort((a, b) => {
      if (a.activeClients !== b.activeClients) {
        return a.activeClients - b.activeClients;
      }
      return new Date(a.lastInteractionTime).getTime() - new Date(b.lastInteractionTime).getTime();
    });
  return availableAgents[0] || null;
};

export function AgentDashboard({ agents, onUpdateAgent, onAddPauseLog }: AgentDashboardProps) {
  const { toast } = useToast();
  const nextAgent = getNextAgent(agents);

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


  const getStatus = (agent: Agent): { text: string; color: string; icon: React.ReactNode } => {
    if (agent.isOnPause) return { text: 'Em Pausa', color: 'bg-yellow-500', icon: <Coffee className="h-2 w-2" /> };
    if (agent.isAvailable) return { text: 'Disponível', color: 'bg-green-500', icon: <Circle className="h-2 w-2 fill-current" /> };
    return { text: 'Indisponível', color: 'bg-red-500', icon: <Circle className="h-2 w-2 fill-current" /> };
  };

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
          {agents.map((agent) => {
            const status = getStatus(agent);
            const isNext = agent.id === nextAgent?.id;
            return (
              <TableRow key={agent.id} className={isNext ? 'bg-primary/10' : ''}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="font-medium">
                      {agent.name}
                      {isNext && <Badge variant="secondary" className="ml-2 bg-accent text-accent-foreground">Próximo</Badge>}
                    </div>
                  </div>
                </TableCell>
                <TableCell>{formatDistanceToNow(new Date(agent.lastInteractionTime), { addSuffix: true, locale: ptBR })}</TableCell>
                <TableCell className="text-center">
                   <div className="flex items-center justify-center gap-2">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleUpdateClients(agent, -1)} disabled={agent.activeClients === 0}>
                            <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-4 font-bold text-lg">{agent.activeClients}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleUpdateClients(agent, 1)} disabled={agent.activeClients === 5}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${status.color}`}></span>
                    {status.text}
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
