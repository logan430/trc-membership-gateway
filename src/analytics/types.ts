/**
 * Analytics type definitions for admin dashboard
 * Used across all analytics services for consistent data structures
 */

// =============================================================================
// Member Overview Types
// =============================================================================

/**
 * ANALYTICS-01: High-level member counts and MRR
 */
export interface MemberOverview {
  totalMembers: number;
  activeMembers: number; // lastActiveAt within 30 days
  inactiveMembers: number;
  newMembers30d: number; // Joined in last 30 days
  mrr: number; // Estimate from subscription counts
}

// =============================================================================
// Engagement Trend Types
// =============================================================================

/**
 * ANALYTICS-02: Daily engagement breakdown
 */
export interface DailyEngagement {
  date: string; // ISO date YYYY-MM-DD
  benchmarks: number;
  downloads: number;
  discordActivity: number;
  total: number;
}

/**
 * ANALYTICS-02: Engagement trend over a period
 */
export interface EngagementTrend {
  data: DailyEngagement[];
  periodStart: string;
  periodEnd: string;
}

/**
 * ANALYTICS-09: Month-over-month engagement comparison
 */
export interface EngagementComparison {
  current: EngagementTrend;
  previous: EngagementTrend;
  change: {
    benchmarks: number; // Percentage
    downloads: number;
    discordActivity: number;
    total: number;
  };
}

// =============================================================================
// Benchmark Statistics Types
// =============================================================================

/**
 * ANALYTICS-03: Stats for a single benchmark category
 */
export interface CategoryStats {
  category: string;
  submissionCount: number;
  validCount: number;
  flaggedCount: number;
  uniqueMembers: number;
}

/**
 * ANALYTICS-03: Aggregate benchmark statistics
 */
export interface BenchmarkStats {
  byCategory: CategoryStats[];
  total: {
    submissions: number;
    validSubmissions: number;
    flaggedSubmissions: number;
    uniqueMembers: number;
  };
}

/**
 * ANALYTICS-03: Benchmark submissions over time by category
 */
export interface BenchmarkTrend {
  date: string;
  category: string;
  count: number;
}

// =============================================================================
// Benchmark Insights Types (ANALYTICS-05)
// =============================================================================

/**
 * ANALYTICS-05: Single metric insight with percentiles
 */
export interface BenchmarkInsight {
  metric: string;
  sampleSize: number;
  median: number | null;
  p25: number | null;
  p75: number | null;
  avg: number | null;
}

/**
 * ANALYTICS-05: Complete insights result with filters applied
 */
export interface BenchmarkInsightsResult {
  filters: SegmentFilters;
  insights: BenchmarkInsight[];
  sampleSize: number;
}

// =============================================================================
// Resource Statistics Types
// =============================================================================

/**
 * ANALYTICS-04: Resource library overview stats
 */
export interface ResourceStats {
  totalResources: number;
  totalDownloads: number;
  uniqueDownloaders: number;
  downloadsThisPeriod: number;
}

/**
 * ANALYTICS-04: Popular resource with download metrics
 */
export interface PopularResource {
  id: string;
  title: string;
  type: string;
  downloadCount: number;
  uniqueDownloaders: number;
}

/**
 * ANALYTICS-04: Trending resource based on recent growth
 */
export interface TrendingResource {
  id: string;
  title: string;
  type: string;
  recentDownloads: number; // Last 7 days
  previousDownloads: number; // 7-14 days ago
  growthPercent: number;
}

// =============================================================================
// Churn Risk Types
// =============================================================================

/**
 * ANALYTICS-07: Individual risk factor in churn scoring
 */
export interface ChurnRiskFactor {
  factor: string;
  points: number;
  description: string;
}

/**
 * ANALYTICS-07: Complete churn risk score for a member
 */
export interface ChurnRiskScore {
  memberId: string;
  email: string;
  discordUsername: string | null;
  score: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high';
  factors: ChurnRiskFactor[];
  lastActiveAt: Date | null;
  subscriptionStatus: string;
}

// =============================================================================
// Cohort Retention Types
// =============================================================================

/**
 * ANALYTICS-06: Single cohort retention row
 */
export interface CohortRow {
  cohort: string; // YYYY-MM format
  month0: number;
  month1: number;
  month2: number;
  month3: number;
  month4: number;
  month5: number;
  // Percentages
  month0Pct: number;
  month1Pct: number;
  month2Pct: number;
  month3Pct: number;
  month4Pct: number;
  month5Pct: number;
}

// =============================================================================
// Common Types
// =============================================================================

/**
 * Date range for filtering analytics queries
 */
export interface DateRange {
  startDate: Date;
  endDate: Date;
}

/**
 * Segment filters for benchmark insights
 */
export interface SegmentFilters {
  companySize?: string;
  industry?: string;
  role?: string;
}
