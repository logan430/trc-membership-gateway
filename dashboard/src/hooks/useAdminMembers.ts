'use client';

/**
 * Admin Members Hooks
 *
 * React Query hooks for admin member management.
 * Uses adminMembersApi from admin-api.ts.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminMembersApi, MemberFilters } from '@/lib/admin-api';

// Query key factory
const memberKeys = {
  all: ['admin', 'members'] as const,
  lists: () => [...memberKeys.all, 'list'] as const,
  list: (filters: MemberFilters) => [...memberKeys.lists(), filters] as const,
  details: () => [...memberKeys.all, 'detail'] as const,
  detail: (id: string) => [...memberKeys.details(), id] as const,
  pointsHistory: (id: string) => [...memberKeys.all, 'pointsHistory', id] as const,
};

/**
 * Hook for fetching paginated members list
 */
export function useMembers(filters: MemberFilters = {}) {
  return useQuery({
    queryKey: memberKeys.list(filters),
    queryFn: () => adminMembersApi.list(filters),
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook for fetching single member details
 */
export function useMember(id: string) {
  return useQuery({
    queryKey: memberKeys.detail(id),
    queryFn: () => adminMembersApi.get(id),
    enabled: !!id,
  });
}

/**
 * Hook for adjusting member points
 */
export function useAdjustPoints(memberId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { points: number; reason?: string; notifyMember?: boolean }) =>
      adminMembersApi.adjustPoints(memberId, data),
    onSuccess: () => {
      // Invalidate member and points history
      queryClient.invalidateQueries({ queryKey: memberKeys.detail(memberId) });
      queryClient.invalidateQueries({ queryKey: memberKeys.pointsHistory(memberId) });
    },
  });
}

/**
 * Hook for member points history
 */
export function usePointsHistory(memberId: string, limit = 50) {
  return useQuery({
    queryKey: memberKeys.pointsHistory(memberId),
    queryFn: () => adminMembersApi.getPointsHistory(memberId, limit),
    enabled: !!memberId,
  });
}

/**
 * Hook for updating member
 */
export function useUpdateMember(memberId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Parameters<typeof adminMembersApi.update>[1]) =>
      adminMembersApi.update(memberId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memberKeys.detail(memberId) });
      queryClient.invalidateQueries({ queryKey: memberKeys.lists() });
    },
  });
}
