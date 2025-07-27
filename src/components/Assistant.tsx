
'use client';

import { useState } from 'react';
import { CornerDownLeft, Bot, Sparkles, LoaderCircle, Mic } from 'lucide-react';
import { runFlow } from '@genkit-ai/next/client';
import type { MessageData } from 'genkit/experimental/ai';
import { z } from 'zod';
import { assistantFlow } from '@/ai/flows/assistant';
import { summarizeDailyOperations, SummarizeDailyOperationsInput } from '@/ai/flows/summarize-daily-operations';
import { analyzeAgentPerformance, AnalyzeAgentPerformanceInput } from '@/ai/flows/analyze-agent-performance';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Agent, PauseLog, AssistantInputSchema, AssistantInput } from '@/lib/types';
import { cn } from '@/lib/utils';

type AssistantProps = {
  agents: Agent[];
  pauseLogs: PauseLog[];
};

const quickPrompts = [
  'Resumo Geral',
  'Melhor Performance',
  'Quem está em pausa?',
];

export function Assistant({ agents, pauseLogs }: AssistantProps) {
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSendMessage = async (prompt?: string) => {
    const userMessage = prompt || input;
    if (!userMessage.trim()) return;

    const newUserMessage: MessageData = { role: 'user', content: [{ text: userMessage }] };
    const newMessages = [...messages, newUserMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
        let response: string | undefined;
        if (prompt === 'Resumo Geral') {
            const summaryData: SummarizeDailyOperationsInput = { agentsData: agents, pauseLogs: pauseLogs };
            const result = await summarizeDailyOperations(summaryData);
            response = result.summary;
        } else if (prompt === 'Melhor Performance') {
            const performanceData: AnalyzeAgentPerformanceInput = { agents, query: 'Qual atendente teve o maior número de atendimentos e qual seu tempo médio?' };
            response = await analyzeAgentPerformance(performanceData);
        } else {
            const assistantInput: AssistantInput = { history: newMessages, agents };
            response = await runFlow(assistantFlow, assistantInput);
        }

        if(response) {
            setMessages(prev => [...prev, { role: 'model', content: [{ text: response as string }] }]);
        }
    } catch (error) {
        console.error('AI flow error:', error);
        toast({
            variant: 'destructive',
            title: 'Erro do Assistente',
            description: 'Não foi possível obter uma resposta da IA.',
        });
        setMessages(prev => [...prev, { role: 'model', content: [{ text: "Desculpe, não consegui processar sua solicitação." }] }]);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          className="fixed bottom-6 right-6 h-16 w-16 rounded-full shadow-lg"
          aria-label="Abrir assistente de IA"
        >
          <Sparkles className="h-8 w-8" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[440px] p-0 rounded-lg shadow-2xl border-none">
        <div className="flex h-[600px] flex-col">
          <div className="flex items-center p-4 bg-primary text-primary-foreground rounded-t-lg">
            <Bot className="h-6 w-6 mr-3" />
            <h3 className="text-lg font-headline font-medium">Assistente OmoFlow</h3>
          </div>

          <ScrollArea className="flex-1 p-4 bg-background">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    'flex items-end gap-2',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-xs rounded-lg px-4 py-2 text-sm md:max-w-md',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {typeof message.content[0].text === 'string' && <p>{message.content[0].text}</p>}
                  </div>
                </div>
              ))}
               {isLoading && (
                    <div className="flex items-center justify-start gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                            <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                    </div>
                )}
            </div>
          </ScrollArea>
          
          <div className="p-4 bg-background border-t">
             <div className="flex gap-2 mb-2">
              {quickPrompts.map((prompt) => (
                <Button key={prompt} variant="outline" size="sm" onClick={() => handleSendMessage(prompt)} disabled={isLoading}>
                  {prompt}
                </Button>
              ))}
            </div>
            <div className="relative">
              <Textarea
                placeholder="Pergunte sobre a performance dos atendentes..."
                className="pr-16"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <Button
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => handleSendMessage()}
                disabled={isLoading || !input.trim()}
              >
                <CornerDownLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
