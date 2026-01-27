'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  adminConfigApi,
  adminTemplatesApi,
  adminAuditApi,
  adminUsersApi,
  AuditLogFilters,
} from '@/lib/admin-api';

// =============================================================================
// Feature Flags Hooks
// =============================================================================

export function useFeatureFlags() {
  return useQuery({
    queryKey: ['admin', 'flags'],
    queryFn: () => adminConfigApi.getFlags(),
  });
}

export function useToggleFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      adminConfigApi.toggleFlag(key, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'flags'] });
    },
  });
}

export function useSeedFlags() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => adminConfigApi.seedFlags(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'flags'] });
    },
  });
}

export function useDiscordChannels() {
  return useQuery({
    queryKey: ['admin', 'discord-channels'],
    queryFn: () => adminConfigApi.getDiscordChannels(),
  });
}

// =============================================================================
// Email Templates Hooks
// =============================================================================

export function useTemplates() {
  return useQuery({
    queryKey: ['admin', 'templates'],
    queryFn: () => adminTemplatesApi.list(),
  });
}

export function useTemplate(name: string) {
  return useQuery({
    queryKey: ['admin', 'template', name],
    queryFn: () => adminTemplatesApi.get(name),
    enabled: !!name,
  });
}

export function useTemplateVariables(name: string) {
  return useQuery({
    queryKey: ['admin', 'template-variables', name],
    queryFn: () => adminTemplatesApi.getVariables(name),
    enabled: !!name,
  });
}

export function useUpdateTemplate(name: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { subject: string; body: string }) =>
      adminTemplatesApi.update(name, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'template', name] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'templates'] });
    },
  });
}

export function usePreviewTemplate(name: string) {
  return useMutation({
    mutationFn: () => adminTemplatesApi.preview(name),
  });
}

export function useResetTemplate(name: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => adminTemplatesApi.reset(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'template', name] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'templates'] });
    },
  });
}

export function useSeedTemplates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => adminTemplatesApi.seed(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'templates'] });
    },
  });
}

// =============================================================================
// Audit Logs Hooks
// =============================================================================

export function useAuditLogs(filters: AuditLogFilters = {}) {
  return useQuery({
    queryKey: ['admin', 'audit', filters],
    queryFn: () => adminAuditApi.list(filters),
  });
}

export function useAuditActions() {
  return useQuery({
    queryKey: ['admin', 'audit', 'actions'],
    queryFn: () => adminAuditApi.getActions(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

export function useAuditEntityTypes() {
  return useQuery({
    queryKey: ['admin', 'audit', 'entity-types'],
    queryFn: () => adminAuditApi.getEntityTypes(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

// =============================================================================
// Admin Users Hooks
// =============================================================================

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin', 'admins'],
    queryFn: () => adminUsersApi.list(),
  });
}

export function useAdminUser(id: string) {
  return useQuery({
    queryKey: ['admin', 'admin', id],
    queryFn: () => adminUsersApi.get(id),
    enabled: !!id,
  });
}

export function useCreateAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; password: string; role: 'ADMIN' | 'SUPER_ADMIN' }) =>
      adminUsersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'admins'] });
    },
  });
}

export function useUpdateAdminRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'ADMIN' | 'SUPER_ADMIN' }) =>
      adminUsersApi.updateRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'admins'] });
    },
  });
}

export function useResetAdminPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      adminUsersApi.resetPassword(id, password),
  });
}

export function useDeleteAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminUsersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'admins'] });
    },
  });
}
