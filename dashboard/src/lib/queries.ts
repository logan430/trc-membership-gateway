/**
 * React Query Configuration
 *
 * Query client settings and query key factories.
 * Used by hooks and providers throughout the dashboard.
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * Default query options
 * - staleTime: Data considered fresh for 30 seconds
 * - gcTime: Keep unused data in cache for 5 minutes
 */
export const defaultQueryOptions = {
  staleTime: 30_000, // 30 seconds
  gcTime: 5 * 60 * 1000, // 5 minutes
};

/**
 * Create a QueryClient instance
 * Called in Providers component, not module-level for SSR safety
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: defaultQueryOptions,
    },
  });
}

/**
 * Query key factories for type-safe, consistent cache keys
 */
export const pointsQueries = {
  all: ['points'] as const,
  summary: () => [...pointsQueries.all, 'summary'] as const,
  history: (params?: { limit?: number; cursor?: string }) =>
    [...pointsQueries.all, 'history', params] as const,
};

export const benchmarksQueries = {
  all: ['benchmarks'] as const,
  categories: () => [...benchmarksQueries.all, 'categories'] as const,
  submissions: () => [...benchmarksQueries.all, 'submissions'] as const,
  results: (category: string, filters?: Record<string, string>) =>
    [...benchmarksQueries.all, 'results', category, filters] as const,
};

export const resourcesQueries = {
  all: ['resources'] as const,
  list: (filters?: { type?: string; tags?: string; search?: string; featured?: boolean }) =>
    [...resourcesQueries.all, 'list', filters] as const,
  detail: (id: string) => [...resourcesQueries.all, 'detail', id] as const,
  tags: () => [...resourcesQueries.all, 'tags'] as const,
  recommended: () => [...resourcesQueries.all, 'recommended'] as const,
};

export const memberQueries = {
  all: ['member'] as const,
  profile: () => [...memberQueries.all, 'profile'] as const,
};
