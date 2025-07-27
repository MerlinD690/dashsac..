
"use client";

import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, Download } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { Agent, PauseLog } from '@/lib/types';

export function ExportButton({ agents, pauseLogs }: { agents: Agent[], pauseLogs: PauseLog[] }) {
  const { toast } = useToast();
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(new Date().setHours(0, 0, 0, 0)),
    to: new Date(new Date().setHours(23, 59, 59, 999)),
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = async () => {
    if (!date?.from || !date?.to) {
      toast({
        variant: 'destructive',
        title: 'Erro de Exportação',
        description: 'Por favor, selecione um intervalo de datas válido.',
      });
      return;
    }

    setIsLoading(true);
    try {
      const filteredLogs = pauseLogs.filter(log => {
        const startTime = new Date(log.pauseStartTime);
        return startTime >= date.from! && startTime <= date.to!;
      });
      
      const agentDataForExport = agents.map(agent => {
        const agentPauseLogs = filteredLogs.filter(log => log.agentName === agent.name);
        const totalPauseTime = agentPauseLogs.reduce((acc, log) => {
            const startTime = new Date(log.pauseStartTime).getTime();
            const endTime = new Date(log.pauseEndTime).getTime();
            return acc + (endTime - startTime);
        }, 0);
        const totalPauseMinutes = (totalPauseTime / 60000).toFixed(2);

        return {
            name: agent.name,
            clientsHandled: agent.totalClientsHandled,
            avgTime: agent.avgTimePerClient.toFixed(2),
            pauseTime: totalPauseMinutes,
        }
      });


      if (agentDataForExport.length === 0) {
        toast({
          title: 'Nenhum Registro',
          description: 'Não há dados de atendentes para exportar.',
        });
        setIsLoading(false);
        return;
      }

      const csvContent = "data:text/csv;charset=utf-8," 
        + "Atendente,Clientes Atendidos,Tempo Médio por Atendimento (min),Tempo Total em Pausa (min)\n"
        + agentDataForExport.map(d => {
            return `${d.name},${d.clientsHandled},${d.avgTime},${d.pauseTime}`;
        }).join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `relatorio_performance_${format(date.from, 'yyyy-MM-dd')}_a_${format(date.to, 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error) {
      console.error("Export failed:", error);
      toast({
        variant: 'destructive',
        title: 'Erro de Exportação',
        description: 'Não foi possível gerar o relatório. Tente novamente.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[300px] justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y", { locale: ptBR })} -{' '}
                  {format(date.to, "LLL dd, y", { locale: ptBR })}
                </>
              ) : (
                format(date.from, "LLL dd, y", { locale: ptBR })
              )
            ) : (
              <span>Selecione uma data</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
      <Button onClick={handleExport} disabled={isLoading}>
        <Download className="mr-2 h-4 w-4" />
        {isLoading ? 'Exportando...' : 'Exportar Relatório'}
      </Button>
    </div>
  );
}
