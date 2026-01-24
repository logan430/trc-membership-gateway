'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { resourcesApi, Resource } from '@/lib/api';

interface ResourceFilters {
  search?: string;
  tags?: string;
  type?: string;
  featured?: boolean;
}

/**
 * Hook for fetching resources with filters
 */
export function useResources(filters: ResourceFilters = {}) {
  return useQuery({
    queryKey: ['resources', filters],
    queryFn: () => resourcesApi.list({
      search: filters.search,
      tags: filters.tags,
      type: filters.type,
      featured: filters.featured,
    }),
    staleTime: 60_000, // 1 minute
  });
}

/**
 * Hook for fetching all available resource tags
 */
export function useResourceTags() {
  return useQuery({
    queryKey: ['resources', 'tags'],
    queryFn: () => resourcesApi.getTags(),
    staleTime: 5 * 60_000, // 5 minutes
  });
}

/**
 * Hook for fetching a single resource by ID
 */
export function useResourceDetail(id: string | null) {
  return useQuery({
    queryKey: ['resources', id],
    queryFn: () => id ? resourcesApi.get(id) : null,
    enabled: !!id,
  });
}

/**
 * Hook for downloading a resource
 * Opens download URL in new tab and invalidates resource cache
 */
export function useDownloadResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (resourceId: string) => resourcesApi.download(resourceId),
    onSuccess: (data) => {
      // Open download URL in new tab
      window.open(data.downloadUrl, '_blank');
      // Invalidate resources to update download counts
      queryClient.invalidateQueries({ queryKey: ['resources'] });
    },
  });
}

export type { Resource, ResourceFilters };
