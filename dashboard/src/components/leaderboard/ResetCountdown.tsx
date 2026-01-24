'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface ResetCountdownProps {
  nextResetAt: string;
}

/**
 * Countdown timer showing time until monthly leaderboard reset (GAME-12)
 * Updates every minute to show days, hours, and minutes remaining
 */
export function ResetCountdown({ nextResetAt }: ResetCountdownProps) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const reset = new Date(nextResetAt);
      const diffMs = reset.getTime() - now.getTime();

      if (diffMs <= 0) {
        return { days: 0, hours: 0, minutes: 0 };
      }

      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      return { days, hours, minutes };
    };

    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 60_000); // Update every minute

    return () => clearInterval(interval);
  }, [nextResetAt]);

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Clock size={14} />
      <span>
        Resets in {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m
      </span>
    </div>
  );
}
