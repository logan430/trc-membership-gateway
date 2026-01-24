'use client';

/**
 * Benchmark data and submission hooks
 *
 * Provides React Query hooks for:
 * - Fetching member's benchmark submissions
 * - Submitting new benchmark data
 * - Fetching benchmark aggregates with filters
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { benchmarksApi, AggregatesResponse } from '@/lib/api';

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
      // Invalidate aggregates to show updated results
      queryClient.invalidateQueries({ queryKey: ['benchmarks', 'aggregates'] });
    },
  });
}

/**
 * Hook to fetch benchmark aggregates for a category
 * Supports segment filtering by company size and industry
 */
export function useAggregates(
  category: BenchmarkCategory,
  filters?: { companySize?: string; industry?: string }
) {
  return useQuery<AggregatesResponse>({
    queryKey: ['benchmarks', 'aggregates', category, filters],
    queryFn: () =>
      benchmarksApi.getAggregates(category, {
        ...(filters?.companySize && { companySize: filters.companySize }),
        ...(filters?.industry && { industry: filters.industry }),
      }),
    staleTime: 5 * 60_000, // 5 minutes - aggregates don't change frequently
  });
}
