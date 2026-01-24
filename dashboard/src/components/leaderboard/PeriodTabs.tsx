'use client';

import type { LeaderboardPeriod } from '@/lib/api';

interface PeriodTabsProps {
  period: LeaderboardPeriod;
  onPeriodChange: (period: LeaderboardPeriod) => void;
}

/**
 * Toggle tabs for leaderboard period selection (GAME-12)
 * Allows switching between monthly and all-time rankings
 */
export function PeriodTabs({ period, onPeriodChange }: PeriodTabsProps) {
  return (
    <div className="inline-flex bg-accent rounded-[8px] p-1">
      <button
        onClick={() => onPeriodChange('month')}
        className={`px-4 py-2 text-sm font-medium rounded-[6px] transition-colors ${
          period === 'month'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        This Month
      </button>
      <button
        onClick={() => onPeriodChange('alltime')}
        className={`px-4 py-2 text-sm font-medium rounded-[6px] transition-colors ${
          period === 'alltime'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        All Time
      </button>
    </div>
  );
}
