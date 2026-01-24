'use client';

import { useState } from 'react';
import { GoldCoinsLoader, Card } from '@/components/ui';
import { LeaderboardTable, PeriodTabs, ResetCountdown } from '@/components/leaderboard';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { TrendingUp, Coins, Download, MessageSquare } from 'lucide-react';
import type { LeaderboardPeriod } from '@/lib/api';

/**
 * Leaderboard Page
 * Shows guild rankings with supportive messaging per CONTEXT.md
 * Features: period toggle, countdown timer, pinned member row, earning guide
 */
export default function LeaderboardPage() {
  const [period, setPeriod] = useState<LeaderboardPeriod>('month');
  const { data, isLoading, error } = useLeaderboard(period);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <GoldCoinsLoader />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">Failed to load leaderboard</p>
      </Card>
    );
  }

  // Calculate percentile (what percent of members you're ahead of)
  const percentile = data?.currentMember && data.totalParticipants > 1
    ? Math.round((1 - data.currentMember.rank / data.totalParticipants) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header with supportive messaging */}
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Guild Rankings</h1>
        <p className="text-muted-foreground">
          Track your progress and celebrate the community&apos;s achievements.
        </p>
      </div>

      {/* Period tabs and countdown (GAME-12) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PeriodTabs period={period} onPeriodChange={setPeriod} />
        {period === 'month' && data?.nextResetAt && (
          <ResetCountdown nextResetAt={data.nextResetAt} />
        )}
      </div>

      {/* Your progress card - supportive tone per CONTEXT.md */}
      {data?.currentMember && (
        <Card className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-gold-dark">
                  #{data.currentMember.rank}
                </div>
                <div className="text-sm text-muted-foreground">Your Rank</div>
              </div>
              <div className="h-12 w-px bg-border hidden sm:block" />
              <div>
                <div className="text-lg font-semibold">
                  {data.currentMember.totalPoints.toLocaleString()} points
                </div>
                <div className="text-sm text-muted-foreground">
                  {period === 'month' ? 'This month' : 'All time'}
                  {percentile > 0 && ` - Top ${100 - percentile}% of the guild`}
                </div>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp size={16} className="text-success" />
              Keep earning to climb the ranks!
            </div>
          </div>
        </Card>
      )}

      {/* Leaderboard table */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <h2 className="text-lg font-semibold">
            Top 25 {period === 'month' ? 'This Month' : 'All Time'}
          </h2>
          <span className="text-sm text-muted-foreground">
            {data?.totalParticipants || 0} total participants
          </span>
        </div>
        <LeaderboardTable
          members={data?.topMembers || []}
          currentMember={data?.currentMember || null}
        />
      </div>

      {/* How to earn points */}
      <Card>
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold">How to Earn Gold</h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 bg-accent rounded-[8px]">
              <div className="flex items-center gap-3">
                <Coins size={20} className="text-gold" />
                <span className="text-sm">Submit benchmark data</span>
              </div>
              <span className="font-semibold text-gold-dark">+50</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-accent rounded-[8px]">
              <div className="flex items-center gap-3">
                <Download size={20} className="text-gold" />
                <span className="text-sm">Download a resource</span>
              </div>
              <span className="font-semibold text-gold-dark">+5</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-accent rounded-[8px]">
              <div className="flex items-center gap-3">
                <MessageSquare size={20} className="text-gold" />
                <span className="text-sm">Discord activity (MEE6)</span>
              </div>
              <span className="font-semibold text-gold-dark">+1 / 100 XP</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-accent rounded-[8px]">
              <div className="flex items-center gap-3">
                <TrendingUp size={20} className="text-gold" />
                <span className="text-sm">Complete introduction</span>
              </div>
              <span className="font-semibold text-gold-dark">+25</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
