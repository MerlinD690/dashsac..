
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
import { PauseLog } from '@/lib/types';

export function ExportButton({ pauseLogs }: { pauseLogs: PauseLog[] }) {
  const { toast } = useToast();
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(new Date().setDate(new Date().getDate() - 7)),
    to: new Date(),
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
      // Filter logs locally instead of fetching from DB
      const logs = pauseLogs.filter(log => {
        const startTime = new Date(log.pauseStartTime);
        return startTime >= date.from! && startTime <= date.to!;
      });

      if (logs.length === 0) {
        toast({
          title: 'Nenhum Registro',
          description: 'Não há registros de pausa no período selecionado.',
        });
        setIsLoading(false);
        return;
      }

      const csvContent = "data:text/csv;charset=utf-8," 
        + "Atendente,Início da Pausa,Fim da Pausa,Duração (min)\n"
        + logs.map(log => {
            const startTime = new Date(log.pauseStartTime);
            const endTime = new Date(log.pauseEndTime);
            const duration = ((endTime.getTime() - startTime.getTime()) / 60000).toFixed(2);
            return `${log.agentName},${format(startTime, 'dd/MM/yyyy HH:mm')},${format(endTime, 'dd/MM/yyyy HH:mm')},${duration}`;
        }).join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `relatorio_pausas_${format(date.from, 'yyyy-MM-dd')}_a_${format(date.to, 'yyyy-MM-dd')}.csv`);
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
        {isLoading ? 'Exportando...' : 'Exportar Relatório de Pausas'}
      </Button>
    </div>
  );
}

