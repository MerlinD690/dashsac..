'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { Agent, PauseLog, AgentDocument } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Coffee, UserCheck, UserX, Lock, Minus, Plus } from 'lucide-react';
import RealTimeClock from './RealTimeClock';
import ClientOnly from './ClientOnly';
import { addPauseLog, updateAgent } from '@/app/actions';
import { useState, useEffect } from 'react';

const AVAILABILITY_PASSWORD = "150121";

// Component to show a running timer for the pause
const PauseTimer = ({ startTime }: { startTime: string }) => {
    const [elapsedTime, setElapsedTime] = useState('');

    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date().getTime();
            const start = new Date(startTime).getTime();
            const difference = now - start;

            const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((difference % (1000 * 60)) / 1000);

            const paddedHours = hours.toString().padStart(2, '0');
            const paddedMinutes = minutes.toString().padStart(2, '0');
            const paddedSeconds = seconds.toString().padStart(2, '0');
            
            setElapsedTime(`${paddedHours}:${paddedMinutes}:${paddedSeconds}`);
        }, 1000);

        return () => clearInterval(timer);
    }, [startTime]);

    return <span className="text-xs font-mono text-yellow-600 ml-2">{elapsedTime}</span>;
};


export function AgentDashboard({ agents, setAgents }: { agents: Agent[]; setAgents: React.Dispatch<React.SetStateAction<Agent[]>> }) {
  const { toast } = useToast();
  
  const [password, setPassword] = useState("");
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [agentToUpdate, setAgentToUpdate] = useState<Agent | null>(null);

  const findNextBestAgent = (agents: Agent[]): string | null => {
    const availableAgents = agents
      .filter(agent => agent.isAvailable && !agent.isOnPause && agent.activeClients === 0)
      .sort((a, b) => {
        const timeA = new Date(a.lastInteractionTime).getTime();
        const timeB = new Date(b.lastInteractionTime).getTime();
        return timeA - timeB;
      });

    return availableAgents.length > 0 ? availableAgents[0].id : null;
  };

  const nextAgentId = findNextBestAgent(agents);

  // Server action to be called in the background
  const handleUpdateOnServer = (agentId: string, updates: Partial<AgentDocument>) => {
      updateAgent(agentId, updates).catch(error => {
          console.error(`Failed to update agent ${agentId}`, error);
          toast({ variant: 'destructive', title: 'Erro de Sincronização', description: 'Não foi possível salvar a alteração. A interface pode estar dessincronizada.' });
      });
  };

  const handleAddLog = (log: Omit<PauseLog, 'id' | 'agentName'> & { agentName: string }) => {
    addPauseLog(log).catch(error => {
        console.error("Failed to add pause log", error);
        toast({ variant: 'destructive', title: 'Erro de Rede', description: 'Não foi possível registrar a pausa no Firestore.' });
    });
  }

  // Optimistic update function
  const optimisticUpdate = (agentId: string, updates: Partial<Agent>) => {
    setAgents(currentAgents => 
      currentAgents.map(agent => 
        agent.id === agentId ? { ...agent, ...updates } : agent
      )
    );
  };

  
  const handleAvailabilityIconClick = (agent: Agent) => {
    if (agent.activeClients > 0 || agent.isOnPause) {
        toast({
            variant: "destructive",
            title: "Ação não permitida",
            description: "Não é possível alterar a disponibilidade de um atendente com clientes ativos ou em pausa.",
        });
        return;
    }
    setAgentToUpdate(agent);
    setIsPasswordDialogOpen(true);
  };

  const handlePasswordCheckAndToggle = () => {
    if (password === AVAILABILITY_PASSWORD) {
        if (agentToUpdate) {
            const available = !agentToUpdate.isAvailable;
            // Optimistic update
            optimisticUpdate(agentToUpdate.id, { isAvailable: available });
            // Server update
            handleUpdateOnServer(agentToUpdate.id, { isAvailable: available });
            toast({
                title: "Sucesso!",
                description: `A disponibilidade de ${agentToUpdate.name} foi alterada.`,
            })
        }
        closePasswordDialog();
    } else {
        toast({
            variant: "destructive",
            title: "Senha Incorreta",
            description: "A senha para alterar a disponibilidade está incorreta.",
        });
    }
  };

  const closePasswordDialog = () => {
    setIsPasswordDialogOpen(false);
    setPassword("");
    setAgentToUpdate(null);
  };


  const handleTogglePause = (agent: Agent) => {
    const canTogglePause = !(!agent.isOnPause && (!agent.isAvailable || agent.activeClients > 0));
    if (!canTogglePause) {
       toast({
        variant: 'destructive',
        title: 'Ação não permitida',
        description: 'Atendentes indisponíveis ou com clientes ativos não podem iniciar uma pausa.',
      });
      return;
    }
    
    const isOnPause = !agent.isOnPause;
    const now = new Date().toISOString();
    const updatesForServer: Partial<AgentDocument> = { isOnPause, lastInteractionTime: now };
    const updatesForClient: Partial<Agent> = { isOnPause, lastInteractionTime: now };

    if (isOnPause) {
        updatesForServer.pauseStartTime = now;
        updatesForClient.pauseStartTime = now;
    } else if(agent.pauseStartTime) {
        const pauseLog = {
            agentName: agent.name,
            pauseStartTime: agent.pauseStartTime,
            pauseEndTime: now,
        };
        handleAddLog(pauseLog);
        updatesForServer.pauseStartTime = undefined;
        updatesForClient.pauseStartTime = undefined;
        updatesForServer.totalClientsHandled = agent.totalClientsHandled;
    }
    
    optimisticUpdate(agent.id, updatesForClient);
    handleUpdateOnServer(agent.id, updatesForServer);
  };
  
  const handleChangeActiveClients = (agent: Agent, change: number) => {
    const newActiveClients = agent.activeClients + change;

    // Prevent going below 0 or above 5
    if (newActiveClients < 0 || newActiveClients > 5) {
      toast({
        variant: "destructive",
        title: "Limite atingido",
        description: `O número de clientes não pode ser menor que 0 ou maior que 5.`,
      });
      return;
    }
    
    // Logic for when a client is added
    let newTotalClientsHandled = agent.totalClientsHandled;
    if (change === 1) {
        newTotalClientsHandled = agent.totalClientsHandled + 1;
    }
    
    const now = new Date().toISOString();
    
    const updatesForClient: Partial<Agent> = { 
        activeClients: newActiveClients, 
        lastInteractionTime: now 
    };
    
    const updatesForServer: Partial<AgentDocument> = { 
        activeClients: newActiveClients, 
        lastInteractionTime: now
    };
    
    if (change === 1) {
        updatesForClient.totalClientsHandled = newTotalClientsHandled;
        updatesForServer.totalClientsHandled = newTotalClientsHandled;
    }

    optimisticUpdate(agent.id, updatesForClient);
    handleUpdateOnServer(agent.id, updatesForServer);
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
    <>
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
              const isDisabledForLock = agent.activeClients > 0 || agent.isOnPause;
              const isDisabledForPause = !agent.isOnPause && (!agent.isAvailable || agent.activeClients > 0);

              return (
                <TableRow key={agent.id} className={cn(isNextAgent && "bg-primary/20 hover:bg-primary/30")}>
                  <TableCell>
                    <div className={cn("font-medium", isNextAgent && "font-bold")}>
                      {agent.name}
                    </div>
                  </TableCell>
                  <TableCell className={cn(isNextAgent && "font-bold")}>{new Date(agent.lastInteractionTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                          <Button variant="outline" size="icon" className='h-7 w-7' onClick={() => handleChangeActiveClients(agent, -1)} disabled={agent.activeClients === 0}>
                              <Minus className="h-4 w-4"/>
                          </Button>
                          <span className={cn("w-4 text-lg", isNextAgent ? "font-bold" : "font-medium")}>{agent.activeClients}</span>
                          <Button variant="outline" size="icon" className='h-7 w-7' onClick={() => handleChangeActiveClients(agent, 1)} disabled={agent.activeClients >= 5}>
                              <Plus className="h-4 w-4"/>
                          </Button>
                      </div>
                  </TableCell>
                  <TableCell>
                    <div className={cn('flex items-center gap-2 font-medium', status.className)}>
                      {status.icon}
                      <span>{status.text}</span>
                      {agent.isOnPause && agent.pauseStartTime && <PauseTimer startTime={agent.pauseStartTime} />}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={() => handleTogglePause(agent)} disabled={isDisabledForPause}>
                          <Coffee className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{agent.isOnPause ? 'Finalizar Pausa' : 'Iniciar Pausa'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <div className='flex items-center justify-end gap-2'>
                        <Switch
                            checked={agent.isAvailable}
                            disabled={true}
                        />
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className='h-7 w-7'
                                    onClick={() => handleAvailabilityIconClick(agent)}
                                    disabled={isDisabledForLock}
                                >
                                    <Lock className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Alterar disponibilidade (requer senha)</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between p-2 border-t">
            <div className='flex-grow'></div>
            <ClientOnly>
                <RealTimeClock />
            </ClientOnly>
        </div>
      </div>
    </TooltipProvider>

    <AlertDialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Acesso Restrito</AlertDialogTitle>
            <AlertDialogDescription>
                Para alterar a disponibilidade de <strong>{agentToUpdate?.name}</strong>, por favor, insira a senha de administrador.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex items-center space-x-2">
                <Input
                    id="password"
                    type="password"
                    placeholder='********'
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handlePasswordCheckAndToggle(); }}
                />
            </div>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={closePasswordDialog}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handlePasswordCheckAndToggle}>
                    <Lock className="mr-2 h-4 w-4" />
                    Confirmar
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
