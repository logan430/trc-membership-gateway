'use client';

/**
 * Analytics Data Hooks
 *
 * React Query hooks for admin analytics dashboard.
 * Uses polling (refetchInterval) for real-time updates per ANALYTICS-10.
 */

import { useQuery } from '@tanstack/react-query';
import { adminAnalyticsApi } from '@/lib/admin-api';

// Query key factory
const analyticsKeys = {
  all: ['admin', 'analytics'] as const,
  overview: () => [...analyticsKeys.all, 'overview'] as const,
  engagement: (start?: string, end?: string) => [...analyticsKeys.all, 'engagement', { start, end }] as const,
  engagementCompare: (start?: string, end?: string) => [...analyticsKeys.all, 'engagement', 'compare', { start, end }] as const,
  benchmarks: () => [...analyticsKeys.all, 'benchmarks'] as const,
  resources: (start?: string, end?: string) => [...analyticsKeys.all, 'resources', { start, end }] as const,
  popularResources: (limit: number) => [...analyticsKeys.all, 'resources', 'popular', limit] as const,
  trendingResources: (limit: number) => [...analyticsKeys.all, 'resources', 'trending', limit] as const,
  cohorts: () => [...analyticsKeys.all, 'cohorts'] as const,
  atRisk: (minScore: number, limit: number) => [...analyticsKeys.all, 'at-risk', { minScore, limit }] as const,
};

/**
 * Member overview (total, active, inactive, MRR)
 */
export function useOverview() {
  return useQuery({
    queryKey: analyticsKeys.overview(),
    queryFn: () => adminAnalyticsApi.getOverview(),
    staleTime: 30_000, // 30 seconds
    refetchInterval: 60_000, // Auto-refresh every minute
  });
}

/**
 * Engagement trend data
 */
export function useEngagement(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: analyticsKeys.engagement(startDate, endDate),
    queryFn: () => adminAnalyticsApi.getEngagement(startDate, endDate),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/**
 * Engagement comparison (month-over-month)
 */
export function useEngagementComparison(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: analyticsKeys.engagementCompare(startDate, endDate),
    queryFn: () => adminAnalyticsApi.getEngagementComparison(startDate, endDate),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/**
 * Benchmark statistics by category
 */
export function useBenchmarkStats() {
  return useQuery({
    queryKey: analyticsKeys.benchmarks(),
    queryFn: () => adminAnalyticsApi.getBenchmarkStats(),
    staleTime: 60_000, // 1 minute
    refetchInterval: 120_000, // 2 minutes
  });
}

/**
 * Resource download statistics
 */
export function useResourceStats(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: analyticsKeys.resources(startDate, endDate),
    queryFn: () => adminAnalyticsApi.getResourceStats(startDate, endDate),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/**
 * Popular resources
 */
export function usePopularResources(limit = 10) {
  return useQuery({
    queryKey: analyticsKeys.popularResources(limit),
    queryFn: () => adminAnalyticsApi.getPopularResources(limit),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

/**
 * Trending resources
 */
export function useTrendingResources(limit = 10) {
  return useQuery({
    queryKey: analyticsKeys.trendingResources(limit),
    queryFn: () => adminAnalyticsApi.getTrendingResources(limit),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

/**
 * Cohort retention data
 */
export function useCohorts() {
  return useQuery({
    queryKey: analyticsKeys.cohorts(),
    queryFn: () => adminAnalyticsApi.getCohorts(),
    staleTime: 300_000, // 5 minutes (changes slowly)
    refetchInterval: 300_000,
  });
}

/**
 * At-risk members (churn prediction)
 */
export function useAtRisk(minScore = 30, limit = 50) {
  return useQuery({
    queryKey: analyticsKeys.atRisk(minScore, limit),
    queryFn: () => adminAnalyticsApi.getAtRisk(minScore, limit),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}
