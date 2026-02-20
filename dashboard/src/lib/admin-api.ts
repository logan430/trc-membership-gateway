/**
 * Admin API Client
 *
 * Uses Bearer token from localStorage (admin authentication pattern)
 * Different from member API which uses httpOnly cookies
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
const TOKEN_KEY = 'adminAccessToken';

class AdminApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

/**
 * Fetch wrapper for admin API calls
 * Uses Bearer token from localStorage
 */
async function adminFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

  if (!token) {
    if (typeof window !== 'undefined') {
      window.location.href = '/admin/login';
    }
    throw new AdminApiError('Not authenticated', 401);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = '/admin/login';
    }
    throw new AdminApiError('Session expired', 401);
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new AdminApiError(error.error || 'Request failed', response.status);
  }

  return response.json();
}

// =============================================================================
// Analytics API Types
// =============================================================================

export interface MemberOverview {
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  newMembers30d: number;
  mrr: number;
}

export interface DailyEngagement {
  date: string;
  benchmarks: number;
  downloads: number;
  discordActivity: number;
  total: number;
}

export interface EngagementTrend {
  data: DailyEngagement[];
  periodStart: string;
  periodEnd: string;
}

export interface EngagementComparison {
  current: EngagementTrend;
  previous: EngagementTrend;
  change: {
    benchmarks: number;
    downloads: number;
    discordActivity: number;
    total: number;
  };
}

export interface CategoryStats {
  category: string;
  submissionCount: number;
  validCount: number;
  flaggedCount: number;
  uniqueMembers: number;
}

export interface BenchmarkStats {
  byCategory: CategoryStats[];
  total: {
    submissions: number;
    validSubmissions: number;
    flaggedSubmissions: number;
    uniqueMembers: number;
  };
}

export interface ResourceStats {
  totalResources: number;
  totalDownloads: number;
  uniqueDownloaders: number;
  downloadsThisPeriod: number;
}

export interface PopularResource {
  id: string;
  title: string;
  type: string;
  downloadCount: number;
  uniqueDownloaders: number;
}

export interface TrendingResource {
  id: string;
  title: string;
  type: string;
  recentDownloads: number;
  previousDownloads: number;
  growthPercent: number;
}

export interface ChurnRiskFactor {
  factor: string;
  points: number;
  description: string;
}

export interface ChurnRiskScore {
  memberId: string;
  email: string;
  discordUsername: string | null;
  score: number;
  riskLevel: 'low' | 'medium' | 'high';
  factors: ChurnRiskFactor[];
  lastActiveAt: string | null;
  subscriptionStatus: string;
}

export interface CohortRow {
  cohort: string;
  month0: number;
  month1: number;
  month2: number;
  month3: number;
  month4: number;
  month5: number;
  month0Pct: number;
  month1Pct: number;
  month2Pct: number;
  month3Pct: number;
  month4Pct: number;
  month5Pct: number;
}

// =============================================================================
// Analytics API Methods
// =============================================================================

export const adminAnalyticsApi = {
  /** Get member overview stats */
  getOverview: () => adminFetch<MemberOverview>('/api/admin/analytics/overview'),

  /** Get engagement trend data */
  getEngagement: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return adminFetch<EngagementTrend>(`/api/admin/analytics/engagement?${params}`);
  },

  /** Get engagement comparison (month-over-month) */
  getEngagementComparison: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return adminFetch<EngagementComparison>(`/api/admin/analytics/engagement/compare?${params}`);
  },

  /** Get benchmark statistics */
  getBenchmarkStats: () => adminFetch<BenchmarkStats>('/api/admin/analytics/benchmarks'),

  /** Get resource statistics */
  getResourceStats: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return adminFetch<ResourceStats>(`/api/admin/analytics/resources?${params}`);
  },

  /** Get popular resources */
  getPopularResources: (limit = 10) =>
    adminFetch<{ resources: PopularResource[] }>(`/api/admin/analytics/resources/popular?limit=${limit}`),

  /** Get trending resources */
  getTrendingResources: (limit = 10) =>
    adminFetch<{ resources: TrendingResource[] }>(`/api/admin/analytics/resources/trending?limit=${limit}`),

  /** Get cohort retention data */
  getCohorts: () => adminFetch<{ cohorts: CohortRow[] }>('/api/admin/analytics/cohorts'),

  /** Get at-risk members */
  getAtRisk: (minScore = 30, limit = 50) =>
    adminFetch<{ members: ChurnRiskScore[]; count: number }>(
      `/api/admin/analytics/at-risk?minScore=${minScore}&limit=${limit}`
    ),

  /** Get single member churn risk */
  getMemberRisk: (memberId: string) => adminFetch<ChurnRiskScore>(`/api/admin/analytics/at-risk/${memberId}`),

  /** Export to CSV - returns URL for download */
  exportCsv: (filters?: Record<string, string>) => {
    const params = new URLSearchParams(filters);
    const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : '';
    // Return URL for direct download (browser handles auth via header)
    return `/api/admin/analytics/export/csv?${params}&token=${token}`;
  },

  /** Export to JSON - returns URL for download */
  exportJson: (filters?: Record<string, string>) => {
    const params = new URLSearchParams(filters);
    const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : '';
    return `/api/admin/analytics/export/json?${params}&token=${token}`;
  },
};

// =============================================================================
// Auth API
// =============================================================================

export const adminAuthApi = {
  /** Login and get token */
  login: async (email: string, password: string) => {
    const response = await fetch(`${API_BASE}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include', // Include cookies for refresh token
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Login failed' }));
      throw new AdminApiError(error.error || 'Login failed', response.status);
    }

    const data = await response.json();
    if (data.accessToken) {
      localStorage.setItem(TOKEN_KEY, data.accessToken);
    }
    return data;
  },

  /** Logout */
  logout: async () => {
    localStorage.removeItem(TOKEN_KEY);
    await fetch(`${API_BASE}/admin/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {
      // Ignore logout errors
    });
  },
};

// =============================================================================
// Members API Types
// =============================================================================

export interface AdminMember {
  id: string;
  email: string;
  name: string | null;
  discordId: string | null;
  discordUsername: string | null;
  subscriptionStatus: string;
  seatTier: string | null;
  totalPoints: number;
  currentStreak: number;
  introCompleted: boolean;
  createdAt: string;
  lastActiveAt: string | null;
}

export interface MembersListResponse {
  members: AdminMember[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface MemberFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PointTransaction {
  id: string;
  action: string;
  actionLabel: string;
  points: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PointsHistoryResponse {
  transactions: PointTransaction[];
  nextCursor: string | null;
  hasMore: boolean;
}

// =============================================================================
// Members API
// =============================================================================

export const adminMembersApi = {
  /** List members with pagination and filters */
  list: (filters: MemberFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', String(filters.page));
    if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
    if (filters.search) params.set('search', filters.search);
    if (filters.status) params.set('subscriptionStatus', filters.status);
    if (filters.sortBy) params.set('sortBy', filters.sortBy);
    if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
    return adminFetch<MembersListResponse>(`/api/admin/members?${params}`);
  },

  /** Get single member details */
  get: (id: string) => adminFetch<{ member: AdminMember }>(`/api/admin/members/${id}`),

  /** Update member */
  update: (id: string, data: Partial<AdminMember>) =>
    adminFetch<{ member: AdminMember }>(`/api/admin/members/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /** Adjust member points */
  adjustPoints: (id: string, data: { points: number; reason?: string; notifyMember?: boolean }) =>
    adminFetch<{ success: boolean; newTotal: number }>(`/api/admin/members/${id}/points/adjust`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Get member points history */
  getPointsHistory: (id: string, limit = 50, cursor?: string) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    return adminFetch<PointsHistoryResponse>(`/api/admin/members/${id}/points/history?${params}`);
  },
};

// =============================================================================
// Feature Flags API
// =============================================================================

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string | null;
  category: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

export const adminConfigApi = {
  /** List all feature flags */
  getFlags: () => adminFetch<{ flags: FeatureFlag[] }>('/api/admin/config/feature-flags'),

  /** Toggle a feature flag */
  toggleFlag: (key: string, enabled: boolean) =>
    adminFetch<{ success: boolean; flag: { key: string; enabled: boolean } }>(
      `/api/admin/config/feature-flags/${key}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      }
    ),

  /** Seed default feature flags */
  seedFlags: () =>
    adminFetch<{ success: boolean; message: string }>('/api/admin/config/feature-flags/seed', {
      method: 'POST',
    }),

  /** Get Discord channel configuration */
  getDiscordChannels: () =>
    adminFetch<{
      channels: { introductions: string | null; billingSupport: string | null; adminAlerts: string | null };
      note: string;
    }>('/api/admin/config/discord-channels'),
};

// =============================================================================
// Email Templates API
// =============================================================================

export interface EmailTemplate {
  name: string;
  subject: string;
  body: string;
  updatedAt: string;
  updatedBy: string | null;
}

export const adminTemplatesApi = {
  /** List all templates */
  list: () => adminFetch<{ templates: EmailTemplate[] }>('/api/admin/templates'),

  /** Get single template - IMPORTANT: API returns {template: {...}} */
  get: async (name: string) => {
    const response = await adminFetch<{ template: EmailTemplate }>(`/api/admin/templates/${name}`);
    return response.template; // Unwrap the nested object (BUG FIX)
  },

  /** Update template */
  update: (name: string, data: { subject: string; body: string }) =>
    adminFetch<{ success: boolean; template: EmailTemplate; warning?: string }>(
      `/api/admin/templates/${name}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    ),

  /** Get template variables */
  getVariables: (name: string) =>
    adminFetch<{ variables: string[] }>(`/api/admin/templates/${name}/variables`),

  /** Preview template with sample data */
  preview: (name: string) =>
    adminFetch<{ preview: { subject: string; body: string }; sampleData: Record<string, string> }>(
      `/api/admin/templates/${name}/preview`
    ),

  /** Reset template to default */
  reset: (name: string) =>
    adminFetch<{ success: boolean; template: EmailTemplate; message: string }>(
      `/api/admin/templates/${name}/reset`,
      { method: 'POST' }
    ),

  /** Seed default templates */
  seed: () =>
    adminFetch<{ success: boolean; created: number }>('/api/admin/templates/seed', {
      method: 'POST',
    }),
};

// =============================================================================
// Audit Log API
// =============================================================================

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  performedBy: string | null;
  createdAt: string;
}

export interface AuditLogFilters {
  cursor?: string;
  limit?: number;
  action?: string;
  entityType?: string;
  entityId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export const adminAuditApi = {
  /** List audit logs with pagination and filters */
  list: (filters: AuditLogFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.cursor) params.set('cursor', filters.cursor);
    if (filters.limit) params.set('limit', String(filters.limit));
    if (filters.action) params.set('action', filters.action);
    if (filters.entityType) params.set('entityType', filters.entityType);
    if (filters.entityId) params.set('entityId', filters.entityId);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.search) params.set('search', filters.search);
    return adminFetch<{
      logs: AuditLogEntry[];
      nextCursor: string | null;
      hasMore: boolean;
    }>(`/api/admin/audit?${params}`);
  },

  /** Get distinct action types for filter dropdown */
  getActions: () => adminFetch<{ actions: string[] }>('/api/admin/audit/actions'),

  /** Get distinct entity types for filter dropdown */
  getEntityTypes: () => adminFetch<{ entityTypes: string[] }>('/api/admin/audit/entity-types'),
};

// =============================================================================
// Admin Users API
// =============================================================================

export interface AdminUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
  createdAt: string;
  lastLoginAt: string | null;
  createdBy: string | null;
}

export const adminUsersApi = {
  /** List all admin users */
  list: () => adminFetch<{ admins: AdminUser[] }>('/api/admin/admins'),

  /** Get single admin with their audit history */
  get: (id: string) =>
    adminFetch<{ admin: AdminUser; actionsPerformed: AuditLogEntry[] }>(`/api/admin/admins/${id}`),

  /** Create new admin */
  create: (data: { email: string; password: string; role: 'ADMIN' | 'SUPER_ADMIN' }) =>
    adminFetch<{ admin: AdminUser }>('/api/admin/admins', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Update admin role */
  updateRole: (id: string, role: 'ADMIN' | 'SUPER_ADMIN') =>
    adminFetch<{ admin: AdminUser }>(`/api/admin/admins/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  /** Reset admin password */
  resetPassword: (id: string, password: string) =>
    adminFetch<{ success: boolean }>(`/api/admin/admins/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  /** Delete admin */
  delete: (id: string) =>
    adminFetch<{ success: boolean }>(`/api/admin/admins/${id}`, {
      method: 'DELETE',
    }),
};

// =============================================================================
// Resources API
// =============================================================================

export type ResourceType = 'TEMPLATE' | 'SOP' | 'PLAYBOOK' | 'COURSE' | 'VIDEO';
export type ResourceStatus = 'DRAFT' | 'PUBLISHED' | 'SCHEDULED';

export interface AdminResource {
  id: string;
  title: string;
  description: string;
  type: ResourceType;
  status: ResourceStatus;
  tags: string[];
  downloadCount: number;
  isFeatured: boolean;
  author: string | null;
  publishAt: string | null;
  currentVersionNumber: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ResourceVersion {
  id: string;
  versionNumber: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  changelog: string | null;
  uploadedBy: string;
  createdAt: string;
}

export interface ResourceTag {
  id: string;
  name: string;
}

export interface ResourceFilters {
  page?: number;
  limit?: number;
  type?: ResourceType;
  status?: ResourceStatus;
  tags?: string;
  search?: string;
  includeDeleted?: boolean;
}

/** Helper to get token (for file upload forms) */
function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export const adminResourcesApi = {
  /** List resources with filters */
  list: (filters: ResourceFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.limit) params.set('limit', String(filters.limit));
    if (filters.type) params.set('type', filters.type);
    if (filters.status) params.set('status', filters.status);
    if (filters.tags) params.set('tags', filters.tags);
    if (filters.search) params.set('search', filters.search);
    if (filters.includeDeleted) params.set('includeDeleted', 'true');
    return adminFetch<{
      resources: AdminResource[];
      nextCursor: string | null;
      hasMore: boolean;
    }>(`/api/admin/resources?${params}`);
  },

  /** Get resource with versions */
  get: (id: string) =>
    adminFetch<{ resource: AdminResource; versions: ResourceVersion[] }>(
      `/api/admin/resources/${id}`
    ),

  /** Create resource with file */
  create: async (
    file: File,
    metadata: {
      title: string;
      description: string;
      type: ResourceType;
      status: ResourceStatus;
      tags: string[];
      isFeatured?: boolean;
      author?: string;
      publishAt?: string;
    }
  ) => {
    const token = getAdminToken();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('metadata', JSON.stringify(metadata));

    const response = await fetch(`${API_BASE}/api/admin/resources`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new AdminApiError(error.error, response.status);
    }

    return response.json();
  },

  /** Update resource metadata */
  update: (id: string, data: Partial<Omit<AdminResource, 'id' | 'createdAt' | 'updatedAt'>>) =>
    adminFetch<{ resource: AdminResource }>(`/api/admin/resources/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /** Upload new version */
  uploadVersion: async (id: string, file: File, changelog?: string) => {
    const token = getAdminToken();
    const formData = new FormData();
    formData.append('file', file);
    if (changelog) formData.append('changelog', changelog);

    const response = await fetch(`${API_BASE}/api/admin/resources/${id}/version`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new AdminApiError(error.error, response.status);
    }

    return response.json();
  },

  /** Soft delete resource */
  delete: (id: string) =>
    adminFetch<{ success: boolean }>(`/api/admin/resources/${id}`, {
      method: 'DELETE',
    }),

  /** Get all tags */
  getTags: () => adminFetch<{ tags: ResourceTag[] }>('/api/admin/resources/tags'),

  /** Create tag */
  createTag: (name: string) =>
    adminFetch<{ tag: ResourceTag }>('/api/admin/resources/tags', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  /** Delete tag */
  deleteTag: (id: string) =>
    adminFetch<{ success: boolean }>(`/api/admin/resources/tags/${id}`, {
      method: 'DELETE',
    }),
};

// =============================================================================
// Benchmarks API
// =============================================================================

export interface FlaggedBenchmark {
  id: string;
  memberId: string;
  category: string;
  data: Record<string, unknown>;
  outlierFields: string[];
  flagReason: string;
  isValid: boolean;
  updatedAt: string;
  member: {
    id: string;
    email: string;
    discordUsername: string | null;
  };
}

export interface BenchmarkStatsItem {
  category: string;
  total: number;
  valid: number;
  flagged: number;
}

export const adminBenchmarksApi = {
  /** Get flagged submissions */
  getFlagged: (filters?: { category?: string; limit?: number; cursor?: string }) => {
    const params = new URLSearchParams();
    if (filters?.category) params.set('category', filters.category);
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.cursor) params.set('cursor', filters.cursor);
    return adminFetch<{
      submissions: FlaggedBenchmark[];
      nextCursor: string | null;
      hasMore: boolean;
    }>(`/api/admin/benchmarks/flagged?${params}`);
  },

  /** Approve flagged submission */
  approve: (id: string) =>
    adminFetch<{ success: boolean }>(`/api/admin/benchmarks/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ action: 'approve' }),
    }),

  /** Reject flagged submission */
  reject: (id: string) =>
    adminFetch<{ success: boolean }>(`/api/admin/benchmarks/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ action: 'reject' }),
    }),

  /** Get benchmark statistics */
  getStats: () =>
    adminFetch<{
      stats: BenchmarkStatsItem[];
      totals: { total: number; valid: number; flagged: number };
    }>('/api/admin/benchmarks/stats'),
};

// =============================================================================
// Points Config API
// =============================================================================

export interface PointConfig {
  action: string;
  label: string;
  points: number;
  enabled: boolean;
  description: string | null;
  updatedAt: string;
}

export const adminPointsConfigApi = {
  /** List all point configs */
  list: () => adminFetch<{ configs: PointConfig[] }>('/api/admin/points-config'),

  /** Update point config */
  update: (
    action: string,
    data: { points: number; enabled: boolean; label?: string; description?: string | null }
  ) =>
    adminFetch<{ success: boolean; config: PointConfig }>(`/api/admin/points-config/${action}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  /** Seed defaults (super admin only) */
  seed: () =>
    adminFetch<{ success: boolean }>('/api/admin/points-config/seed', {
      method: 'POST',
    }),
};

export { AdminApiError };
