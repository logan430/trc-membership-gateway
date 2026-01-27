'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  adminResourcesApi,
  ResourceFilters,
  ResourceType,
  ResourceStatus,
} from '@/lib/admin-api';

export function useResources(filters: ResourceFilters = {}) {
  return useQuery({
    queryKey: ['admin', 'resources', filters],
    queryFn: () => adminResourcesApi.list(filters),
  });
}

export function useResource(id: string) {
  return useQuery({
    queryKey: ['admin', 'resource', id],
    queryFn: () => adminResourcesApi.get(id),
    enabled: !!id,
  });
}

export function useCreateResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      metadata,
    }: {
      file: File;
      metadata: {
        title: string;
        description: string;
        type: ResourceType;
        status: ResourceStatus;
        tags: string[];
        isFeatured?: boolean;
        author?: string;
      };
    }) => adminResourcesApi.create(file, metadata),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'resources'] });
    },
  });
}

export function useUpdateResource(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof adminResourcesApi.update>[1]) =>
      adminResourcesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'resource', id] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'resources'] });
    },
  });
}

export function useUploadVersion(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, changelog }: { file: File; changelog?: string }) =>
      adminResourcesApi.uploadVersion(id, file, changelog),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'resource', id] });
    },
  });
}

export function useDeleteResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminResourcesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'resources'] });
    },
  });
}

export function useResourceTags() {
  return useQuery({
    queryKey: ['admin', 'resourceTags'],
    queryFn: () => adminResourcesApi.getTags(),
  });
}
