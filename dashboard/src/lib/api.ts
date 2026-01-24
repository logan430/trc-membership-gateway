/**
 * API Client for Express Backend
 *
 * All API calls go to Express (same origin via proxy or direct).
 * Credentials are included to forward httpOnly cookies.
 */

// Base URL for API calls
// In production: same origin (proxied through Express)
// In development: can be direct or proxied
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Fetch wrapper with credentials and error handling
 */
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // CRITICAL: Include cookies for auth
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  // Handle auth errors
  if (response.status === 401) {
    // Redirect to login if on client side
    if (typeof window !== 'undefined') {
      window.location.href = '/login?reason=session_expired';
    }
    throw new ApiError('Session expired', 401);
  }

  // Handle other errors
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(error.error || 'Request failed', response.status);
  }

  // Parse JSON response
  return response.json();
}

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// =============================================================================
// API Methods - Points
// =============================================================================

export interface PointsBreakdown {
  action: string;
  actionLabel: string;
  points: number;
}

export interface PointsSummary {
  totalPoints: number;
  currentStreak: number;
  breakdown: PointsBreakdown[];
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

export interface PointValue {
  action: string;
  label: string;
  points: number;
  description?: string;
}

export const pointsApi = {
  /** Get member's point summary */
  getSummary: () => apiFetch<PointsSummary>('/api/points/summary'),

  /** Get member's point history with cursor pagination */
  getHistory: (limit = 20, cursor?: string) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    return apiFetch<PointsHistoryResponse>(`/api/points/history?${params}`);
  },

  /** Get point values configuration */
  getValues: () => apiFetch<{ values: PointValue[] }>('/api/points/values'),
};

// =============================================================================
// API Methods - Benchmarks
// =============================================================================

export interface BenchmarkSubmission {
  id: string;
  category: string;
  data: Record<string, unknown>;
  isValid: boolean;
  submittedAt: string;
  updatedAt: string;
}

export interface BenchmarkSubmitResponse {
  submission: BenchmarkSubmission;
  outlierFields?: string[];
  pointsAwarded: number;
}

export interface MySubmissionsResponse {
  submissions: BenchmarkSubmission[];
}

export const benchmarksApi = {
  /** Get member's submissions for all categories */
  getMySubmissions: () =>
    apiFetch<MySubmissionsResponse>('/api/benchmarks/my-submissions'),

  /** Submit benchmark data */
  submit: (category: string, data: Record<string, unknown>) =>
    apiFetch<BenchmarkSubmitResponse>('/api/benchmarks/submit', {
      method: 'POST',
      body: JSON.stringify({ category, data }),
    }),

  /** Get benchmark results/aggregates for a category */
  getAggregates: (category: string, filters?: Record<string, string>) => {
    const params = new URLSearchParams(filters);
    return apiFetch<Record<string, unknown>>(
      `/api/benchmarks/aggregates/${category}?${params}`
    );
  },
};

// =============================================================================
// API Methods - Resources
// =============================================================================

export interface Resource {
  id: string;
  title: string;
  description: string;
  type: string;
  tags: string[];
  downloadCount: number;
  createdAt: string;
  isFeatured?: boolean;
  author?: string;
  fileSize?: number;
  mimeType?: string;
}

export const resourcesApi = {
  /** List resources with optional filters */
  list: (filters?: { type?: string; tags?: string; search?: string; featured?: boolean; limit?: number; cursor?: string }) => {
    const params = new URLSearchParams();
    if (filters?.type) params.set('type', filters.type);
    if (filters?.tags) params.set('tags', filters.tags);
    if (filters?.search) params.set('search', filters.search);
    if (filters?.featured !== undefined) params.set('featured', String(filters.featured));
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.cursor) params.set('cursor', filters.cursor);
    return apiFetch<{ resources: Resource[]; nextCursor?: string; hasMore: boolean }>(
      `/api/resources?${params}`
    );
  },

  /** Get resource details */
  get: (id: string) => apiFetch<{ resource: Resource }>(`/api/resources/${id}`),

  /** Download resource (returns signed URL) */
  download: (id: string) =>
    apiFetch<{ downloadUrl: string; expiresAt: string; pointsAwarded: number }>(`/api/resources/${id}/download`, {
      method: 'POST',
    }),

  /** Get recommended resources */
  getRecommended: () => apiFetch<{ resources: Resource[] }>('/api/resources/recommended'),

  /** Get all available tags for filtering */
  getTags: () => apiFetch<{ tags: string[] }>('/api/resources/tags'),
};

// =============================================================================
// API Methods - Member Profile
// =============================================================================

export interface MemberProfile {
  id: string;
  email: string;
  name: string | null;
  discordId: string | null;
  discordUsername: string | null;
  totalPoints: number;
  currentStreak: number;
  createdAt: string;
}

export const memberApi = {
  /** Get current member's profile */
  getProfile: () => apiFetch<MemberProfile>('/dashboard/profile'),

  /** Update profile */
  updateProfile: (data: { name?: string }) =>
    apiFetch<MemberProfile>('/dashboard/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

// Export all APIs
export const api = {
  points: pointsApi,
  benchmarks: benchmarksApi,
  resources: resourcesApi,
  member: memberApi,
};
