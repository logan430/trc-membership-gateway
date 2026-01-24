'use client';

import { useQuery } from '@tanstack/react-query';
import { leaderboardApi, type LeaderboardPeriod } from '@/lib/api';

/**
 * Hook for fetching leaderboard data with period support
 * Stale time and refetch interval per JOBS-03 (5 minutes)
 */
export function useLeaderboard(period: LeaderboardPeriod = 'month') {
  return useQuery({
    queryKey: ['leaderboard', period],
    queryFn: () => leaderboardApi.get(period),
    staleTime: 5 * 60_000, // 5 minutes per JOBS-03
    refetchInterval: 5 * 60_000, // Auto-refresh every 5 minutes
  });
}
