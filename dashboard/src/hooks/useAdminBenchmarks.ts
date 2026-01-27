'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminBenchmarksApi } from '@/lib/admin-api';

export function useFlaggedBenchmarks(category?: string) {
  return useQuery({
    queryKey: ['admin', 'benchmarks', 'flagged', category],
    queryFn: () => adminBenchmarksApi.getFlagged({ category }),
  });
}

export function useBenchmarkStats() {
  return useQuery({
    queryKey: ['admin', 'benchmarks', 'stats'],
    queryFn: () => adminBenchmarksApi.getStats(),
  });
}

export function useApproveBenchmark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminBenchmarksApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'benchmarks'] });
    },
  });
}

export function useRejectBenchmark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminBenchmarksApi.reject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'benchmarks'] });
    },
  });
}
