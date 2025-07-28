
"use client";

import { useState, useEffect } from 'react';

export default function RealTimeClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timerId = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timerId);
    };
  }, []);

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
