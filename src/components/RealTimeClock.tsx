
"use client";

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export default function RealTimeClock() {
  const [time, setTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'ononline' in window && 'onoffline' in window) {
      setIsOnline(navigator.onLine);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  useEffect(() => {
    const timerId = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timerId);
    };
  }, []);

  return (
    <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
            <span className={cn("h-2.5 w-2.5 rounded-full", isOnline ? 'bg-green-500' : 'bg-gray-400')} />
            <span>{isOnline ? 'Online' : 'Offline'}</span>
        </div>
        <span>|</span>
        <div>
            {time.toLocaleDateString('pt-BR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            })}
        </div>
         <span>|</span>
        <div>
            {time.toLocaleTimeString('pt-BR')}
        </div>
    </div>
  );
}
