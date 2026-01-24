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

export interface PointsSummary {
  totalPoints: number;
  currentStreak: number;
  monthlyPoints: number;
  lastActiveAt: string | null;
}

export interface PointTransaction {
  id: string;
  points: number;
  type: string;
  reason: string;
  createdAt: string;
}

export const pointsApi = {
  /** Get member's point summary */
  getSummary: () => apiFetch<PointsSummary>('/api/points/summary'),

  /** Get member's point history */
  getHistory: (limit = 20, offset = 0) =>
    apiFetch<{ transactions: PointTransaction[]; total: number }>(
      `/api/points/history?limit=${limit}&offset=${offset}`
    ),

  /** Get point values configuration */
  getValues: () => apiFetch<Record<string, number>>('/api/points/values'),
};

// =============================================================================
// API Methods - Benchmarks
// =============================================================================

export interface BenchmarkCategory {
  id: string;
  name: string;
  description: string;
  submissionCount: number;
  hasSubmitted: boolean;
}

export const benchmarksApi = {
  /** Get available benchmark categories */
  getCategories: () => apiFetch<BenchmarkCategory[]>('/api/benchmarks/categories'),

  /** Get member's submissions */
  getSubmissions: () => apiFetch<Record<string, unknown>[]>('/api/benchmarks/submissions'),

  /** Submit benchmark data */
  submit: (category: string, data: Record<string, unknown>) =>
    apiFetch<{ id: string }>('/api/benchmarks/submit', {
      method: 'POST',
      body: JSON.stringify({ category, data }),
    }),

  /** Get benchmark results for a category */
  getResults: (category: string, filters?: Record<string, string>) => {
    const params = new URLSearchParams(filters);
    return apiFetch<Record<string, unknown>>(
      `/api/benchmarks/results/${category}?${params}`
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
}

export const resourcesApi = {
  /** List resources with optional filters */
  list: (filters?: { type?: string; tags?: string; search?: string; limit?: number; offset?: number }) => {
    const params = new URLSearchParams();
    if (filters?.type) params.set('type', filters.type);
    if (filters?.tags) params.set('tags', filters.tags);
    if (filters?.search) params.set('search', filters.search);
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.offset) params.set('offset', String(filters.offset));
    return apiFetch<{ resources: Resource[]; total: number }>(
      `/api/resources?${params}`
    );
  },

  /** Get resource details */
  get: (id: string) => apiFetch<Resource>(`/api/resources/${id}`),

  /** Download resource (returns signed URL) */
  download: (id: string) =>
    apiFetch<{ url: string }>(`/api/resources/${id}/download`, {
      method: 'POST',
    }),

  /** Get recommended resources */
  getRecommended: () => apiFetch<Resource[]>('/api/resources/recommended'),
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
