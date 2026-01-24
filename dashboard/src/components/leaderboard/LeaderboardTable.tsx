'use client';

import { Flame, User } from 'lucide-react';
import { RankBadge } from './RankBadge';
import type { LeaderboardMember } from '@/lib/api';

interface LeaderboardTableProps {
  members: LeaderboardMember[];
  currentMember: LeaderboardMember | null;
}

/**
 * Main leaderboard table component
 * Shows top 25 members with rank badges, streaks, and points
 * Pins current member row at bottom if outside top 25
 */
export function LeaderboardTable({ members, currentMember }: LeaderboardTableProps) {
  const memberInTop25 = members.some((m) => m.isCurrent);

  return (
    <div className="relative">
      <div className="border border-border rounded-[8px] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-accent border-b border-border grid grid-cols-12 gap-2 text-sm font-medium text-muted-foreground">
          <div className="col-span-1">Rank</div>
          <div className="col-span-7">Member</div>
          <div className="col-span-2 text-right">Streak</div>
          <div className="col-span-2 text-right">Points</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-border">
          {members.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground">
              No members on the leaderboard yet. Start earning points to climb the ranks!
            </div>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                className={`px-4 py-3 grid grid-cols-12 gap-2 items-center ${
                  member.isCurrent ? 'bg-gold/5' : ''
                }`}
              >
                <div className="col-span-1">
                  <RankBadge rank={member.rank} />
                </div>
                <div className="col-span-7 flex items-center gap-3">
                  <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center flex-shrink-0">
                    <User size={16} className="text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-medium truncate block">
                      {member.discordUsername || 'Anonymous'}
                    </span>
                    {member.isCurrent && (
                      <span className="text-xs text-muted-foreground">(You)</span>
                    )}
                  </div>
                </div>
                <div className="col-span-2 text-right">
                  {member.currentStreak > 0 && (
                    <span className="inline-flex items-center gap-1 text-sm text-orange-500">
                      <Flame size={14} />
                      {member.currentStreak}
                    </span>
                  )}
                </div>
                <div className="col-span-2 text-right">
                  <span className="font-bold">{member.totalPoints.toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Pinned current member row if outside top 25 */}
      {!memberInTop25 && currentMember && (
        <div className="mt-4 border-2 border-gold/30 rounded-[8px] overflow-hidden pixel-border">
          <div className="px-4 py-3 bg-gold/5 grid grid-cols-12 gap-2 items-center">
            <div className="col-span-1">
              <RankBadge rank={currentMember.rank} />
            </div>
            <div className="col-span-7 flex items-center gap-3">
              <div className="w-8 h-8 bg-gold/20 rounded-full flex items-center justify-center flex-shrink-0">
                <User size={16} className="text-gold-dark" />
              </div>
              <div className="min-w-0">
                <span className="font-medium truncate block">
                  {currentMember.discordUsername || 'Anonymous'}
                </span>
                <span className="text-xs text-muted-foreground">(You)</span>
              </div>
            </div>
            <div className="col-span-2 text-right">
              {currentMember.currentStreak > 0 && (
                <span className="inline-flex items-center gap-1 text-sm text-orange-500">
                  <Flame size={14} />
                  {currentMember.currentStreak}
                </span>
              )}
            </div>
            <div className="col-span-2 text-right">
              <span className="font-bold">{currentMember.totalPoints.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
