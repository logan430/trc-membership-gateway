'use client';

/**
 * Profile and Account Data Hooks
 *
 * React Query hooks for fetching and updating profile data,
 * account settings, and privacy preferences.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardApi, authApi, memberPrivacyApi } from '@/lib/api';

/**
 * Hook to fetch dashboard profile data
 * Returns member info, claim status, team info, and activity timeline
 */
export function useProfile() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.get(),
    staleTime: 60_000, // 1 minute
  });
}

/**
 * Hook to fetch member's privacy settings
 * Used by account settings page
 */
export function usePrivacySettings() {
  return useQuery({
    queryKey: ['member', 'privacy'],
    queryFn: () => memberPrivacyApi.getPrivacy(),
    staleTime: 60_000, // 1 minute
  });
}

/**
 * Hook to update member's email address
 * Requires current password for verification
 */
export function useUpdateEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { newEmail: string; currentPassword: string }) =>
      authApi.updateEmail(data),
    onSuccess: () => {
      // Invalidate dashboard to refresh email display
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/**
 * Hook to update member's password
 * Requires current password for verification
 */
export function useUpdatePassword() {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      authApi.updatePassword(data),
  });
}

/**
 * Hook to update leaderboard visibility preference
 * GAME-11: Privacy setting for leaderboard opt-out
 */
export function useUpdateLeaderboardVisibility() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (leaderboardVisible: boolean) =>
      memberPrivacyApi.updatePrivacy({ leaderboardVisible }),
    onSuccess: () => {
      // Invalidate privacy settings
      queryClient.invalidateQueries({ queryKey: ['member', 'privacy'] });
      // Invalidate dashboard to refresh leaderboardVisible in member data
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      // Invalidate leaderboard so it reflects the change
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}
