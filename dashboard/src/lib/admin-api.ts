/**
 * Admin API Client
 *
 * Uses Bearer token from localStorage (admin authentication pattern)
 * Different from member API which uses httpOnly cookies
 */

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
      window.location.href = '/app/admin/login';
    }
    throw new AdminApiError('Not authenticated', 401);
  }

  const response = await fetch(endpoint, {
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
      window.location.href = '/app/admin/login';
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

export { AdminApiError };
