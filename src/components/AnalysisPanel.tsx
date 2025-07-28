
'use client';

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Bot, Users, Activity } from 'lucide-react';
import { Agent, PauseLog, AnalysisOutput } from '@/lib/types';
import { analyzeAgents } from '@/ai/flows/analyzeAgents';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function AnalysisResult({ result }: { result: AnalysisOutput }) {
  return (
    <div className="space-y-4 text-sm">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity /> Destaques do Dia
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1 rounded-lg border p-3">
            <p className="font-semibold text-green-600">Mais Produtivo</p>
            <p className="text-muted-foreground">{result.mostProductiveAgent.name}</p>
            <p className="font-bold">{result.mostProductiveAgent.clientsHandled} clientes</p>
          </div>
          <div className="flex flex-col gap-1 rounded-lg border p-3">
            <p className="font-semibold text-red-600">Menos Produtivo</p>
            <p className="text-muted-foreground">{result.leastProductiveAgent.name}</p>
            <p className="font-bold">{result.leastProductiveAgent.clientsHandled} clientes</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users /> Performance Individual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {result.agentPerformance
            .sort((a, b) => b.clientsHandled - a.clientsHandled)
            .map((agent) => (
            <div key={agent.name} className="flex items-center justify-between rounded-lg border p-3">
              <p className="font-medium">{agent.name}</p>
              <div className='text-right'>
                <p>{agent.clientsHandled} clientes</p>
                <p className="text-xs text-muted-foreground">{agent.totalPauseTime} em pausa</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
                <Bot /> Resumo da IA
            </CardTitle>
        </CardHeader>
        <CardContent>
             <p className="text-muted-foreground whitespace-pre-wrap">{result.overallSummary}</p>
        </CardContent>
      </Card>
      
    </div>
  );
}

function LoadingSkeleton() {
    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-1/2" />
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-1/2" />
                </CardHeader>
                <CardContent className="space-y-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-1/2" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-24 w-full" />
                </CardContent>
            </Card>
        </div>
    )
}

export function AnalysisPanel({ agents, pauseLogs }: { agents: Agent[], pauseLogs: PauseLog[] }) {
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisOutput | null>(null);
  const { toast } = useToast();

  const handleAnalysis = async () => {
    setIsLoading(true);
    setAnalysisResult(null);
    try {
      const result = await analyzeAgents({ agents, pauseLogs });
      setAnalysisResult(result);
    } catch (error) {
      console.error('AI analysis failed:', error);
      toast({
        variant: 'destructive',
        title: 'Erro na Análise',
        description: 'A IA não conseguiu processar os dados. Tente novamente.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">
          <Bot className="mr-2 h-4 w-4" />
          Análise com IA
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full max-w-md flex flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Análise de Performance com IA</SheetTitle>
          <SheetDescription>
            A IA irá analisar os dados de performance dos atendentes e gerar insights sobre o dia de trabalho.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-1 pr-4">
            {isLoading && <LoadingSkeleton />}
            {analysisResult && <AnalysisResult result={analysisResult} />}
            {!isLoading && !analysisResult && (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed">
                    <div className='text-center text-muted-foreground'>
                        <Bot className="mx-auto h-12 w-12" />
                        <p className="mt-2">A análise da IA aparecerá aqui.</p>
                    </div>
                </div>
            )}
        </div>
        <SheetFooter className='pt-4 border-t'>
            <Button onClick={handleAnalysis} disabled={isLoading} className='w-full'>
                <Bot className="mr-2 h-4 w-4" />
                {isLoading ? 'Analisando...' : 'Analisar Performance'}
            </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
