'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminPointsConfigApi } from '@/lib/admin-api';

export function usePointConfigs() {
  return useQuery({
    queryKey: ['admin', 'pointsConfig'],
    queryFn: () => adminPointsConfigApi.list(),
  });
}

export function useUpdatePointConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      action,
      data,
    }: {
      action: string;
      data: { points: number; enabled: boolean; label?: string; description?: string | null };
    }) => adminPointsConfigApi.update(action, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'pointsConfig'] });
    },
  });
}
