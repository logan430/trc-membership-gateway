'use client';

/**
 * Points Data Hooks
 *
 * React Query hooks for fetching member points data.
 * Used by dashboard pages to display real-time points information.
 */

import { useQuery } from '@tanstack/react-query';
import { pointsApi } from '@/lib/api';
import { pointsQueries } from '@/lib/queries';

/**
 * Hook to fetch member's points summary
 * Returns totalPoints and breakdown by action type
 */
export function usePointsSummary() {
  return useQuery({
    queryKey: pointsQueries.summary(),
    queryFn: () => pointsApi.getSummary(),
    staleTime: 30_000, // 30 seconds
  });
}

/**
 * Hook to fetch member's point transaction history
 * Returns paginated list of recent transactions
 */
export function usePointsHistory(limit = 10) {
  return useQuery({
    queryKey: pointsQueries.history({ limit }),
    queryFn: () => pointsApi.getHistory(limit),
    staleTime: 30_000, // 30 seconds
  });
}

/**
 * Hook to fetch point values configuration
 * Shows how many points each action is worth
 */
export function usePointsValues() {
  return useQuery({
    queryKey: ['points', 'values'],
    queryFn: () => pointsApi.getValues(),
    staleTime: 5 * 60_000, // 5 minutes - values change rarely
  });
}
