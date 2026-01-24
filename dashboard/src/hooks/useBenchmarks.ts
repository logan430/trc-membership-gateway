'use client';

/**
 * Benchmark data and submission hooks
 *
 * Provides React Query hooks for:
 * - Fetching member's benchmark submissions
 * - Submitting new benchmark data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { benchmarksApi } from '@/lib/api';

export type BenchmarkCategory = 'COMPENSATION' | 'INFRASTRUCTURE' | 'BUSINESS' | 'OPERATIONAL';

/**
 * Hook to fetch member's benchmark submissions
 * Returns submissions for all categories
 */
export function useMySubmissions() {
  return useQuery({
    queryKey: ['benchmarks', 'my-submissions'],
    queryFn: () => benchmarksApi.getMySubmissions(),
    staleTime: 60_000, // Consider fresh for 1 minute
  });
}

/**
 * Hook to submit benchmark data for a category
 * Invalidates submissions and points queries on success
 */
export function useSubmitBenchmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ category, data }: { category: BenchmarkCategory; data: Record<string, unknown> }) =>
      benchmarksApi.submit(category, data),
    onSuccess: () => {
      // Invalidate submissions to show new submission
      queryClient.invalidateQueries({ queryKey: ['benchmarks', 'my-submissions'] });
      // Invalidate points to show new total (benchmark submission awards points)
      queryClient.invalidateQueries({ queryKey: ['points'] });
    },
  });
}
