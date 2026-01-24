/**
 * Admin Analytics API Routes
 * Endpoints for admin analytics dashboard
 *
 * All endpoints require admin authentication via Bearer token.
 * ANALYTICS-10: No caching - data updates in real-time.
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../../admin/middleware.js';

// Analytics services (from Plan 33-01)
import { getMemberOverview, getCohortRetention } from '../../analytics/member-analytics.js';
import { getEngagementTrend, getEngagementComparison } from '../../analytics/engagement-analytics.js';
import { getBenchmarkStats, getBenchmarkTrends } from '../../analytics/benchmark-analytics.js';
import { getResourceStats, getPopularResources, getTrendingResources } from '../../analytics/resource-analytics.js';
import { getAtRiskMembers, calculateChurnRisk } from '../../analytics/churn-prediction.js';
import { exportMembersToCsv, exportMembersToJson } from '../../analytics/export.js';

export const adminAnalyticsRouter = Router();

// Apply admin auth to all routes
adminAnalyticsRouter.use(requireAdmin);

// Date range schema for query params
const dateRangeSchema = z.object({
  startDate: z.string().optional().transform((s) => s ? new Date(s) : undefined),
  endDate: z.string().optional().transform((s) => s ? new Date(s) : undefined),
});

// Helper to get default 30-day range
function getDefaultRange() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  return { startDate, endDate };
}

/**
 * GET /api/admin/analytics/overview
 * ANALYTICS-01: Member overview (total, active, inactive, MRR)
 */
adminAnalyticsRouter.get('/overview', async (req, res) => {
  const overview = await getMemberOverview();
  res.json(overview);
});

/**
 * GET /api/admin/analytics/engagement
 * ANALYTICS-02: Engagement metrics with time-series
 * Query params: startDate, endDate (defaults to last 30 days)
 */
adminAnalyticsRouter.get('/engagement', async (req, res) => {
  const query = dateRangeSchema.parse(req.query);
  const range = query.startDate && query.endDate
    ? { startDate: query.startDate, endDate: query.endDate }
    : getDefaultRange();

  const trend = await getEngagementTrend(range);
  res.json(trend);
});

/**
 * GET /api/admin/analytics/engagement/compare
 * ANALYTICS-09: Month-over-month comparison
 * Query params: startDate, endDate for current period (previous period auto-calculated)
 */
adminAnalyticsRouter.get('/engagement/compare', async (req, res) => {
  const query = dateRangeSchema.parse(req.query);

  // Current period
  const currentRange = query.startDate && query.endDate
    ? { startDate: query.startDate, endDate: query.endDate }
    : getDefaultRange();

  // Calculate previous period (same duration, immediately before)
  const duration = currentRange.endDate.getTime() - currentRange.startDate.getTime();
  const previousRange = {
    startDate: new Date(currentRange.startDate.getTime() - duration),
    endDate: new Date(currentRange.endDate.getTime() - duration),
  };

  const comparison = await getEngagementComparison(currentRange, previousRange);
  res.json(comparison);
});

/**
 * GET /api/admin/analytics/benchmarks
 * ANALYTICS-03: Benchmark submission stats by category
 */
adminAnalyticsRouter.get('/benchmarks', async (req, res) => {
  const stats = await getBenchmarkStats();
  res.json(stats);
});

/**
 * GET /api/admin/analytics/benchmarks/trends
 * ANALYTICS-03: Benchmark submission trends over time
 */
adminAnalyticsRouter.get('/benchmarks/trends', async (req, res) => {
  const query = dateRangeSchema.parse(req.query);
  const range = query.startDate && query.endDate
    ? { startDate: query.startDate, endDate: query.endDate }
    : getDefaultRange();

  const trends = await getBenchmarkTrends(range);
  res.json({ trends });
});

/**
 * GET /api/admin/analytics/resources
 * ANALYTICS-04: Resource download stats
 */
adminAnalyticsRouter.get('/resources', async (req, res) => {
  const query = dateRangeSchema.parse(req.query);
  const range = query.startDate && query.endDate
    ? { startDate: query.startDate, endDate: query.endDate }
    : undefined;

  const stats = await getResourceStats(range);
  res.json(stats);
});

/**
 * GET /api/admin/analytics/resources/popular
 * ANALYTICS-04: Most popular resources
 */
adminAnalyticsRouter.get('/resources/popular', async (req, res) => {
  const limit = z.coerce.number().min(1).max(50).default(10).parse(req.query.limit);
  const resources = await getPopularResources(limit);
  res.json({ resources });
});

/**
 * GET /api/admin/analytics/resources/trending
 * ANALYTICS-04: Trending resources (growth-based)
 */
adminAnalyticsRouter.get('/resources/trending', async (req, res) => {
  const limit = z.coerce.number().min(1).max(50).default(10).parse(req.query.limit);
  const resources = await getTrendingResources(limit);
  res.json({ resources });
});

/**
 * GET /api/admin/analytics/cohorts
 * ANALYTICS-06: Cohort retention analysis
 */
adminAnalyticsRouter.get('/cohorts', async (req, res) => {
  const cohorts = await getCohortRetention();
  res.json({ cohorts });
});

/**
 * GET /api/admin/analytics/at-risk
 * ANALYTICS-07: At-risk members (churn prediction)
 */
adminAnalyticsRouter.get('/at-risk', async (req, res) => {
  const query = z.object({
    minScore: z.coerce.number().min(0).max(100).default(30),
    limit: z.coerce.number().min(1).max(100).default(50),
  }).parse(req.query);

  const members = await getAtRiskMembers(query.minScore, query.limit);
  res.json({ members, count: members.length });
});

/**
 * GET /api/admin/analytics/at-risk/:memberId
 * ANALYTICS-07: Individual member churn risk details
 */
adminAnalyticsRouter.get('/at-risk/:memberId', async (req, res) => {
  const { memberId } = z.object({ memberId: z.string() }).parse(req.params);
  const risk = await calculateChurnRisk(memberId);

  if (!risk) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  res.json(risk);
});

// Export filters schema
const exportFiltersSchema = z.object({
  subscriptionStatus: z.string().optional().transform((s) => s?.split(',').filter(Boolean)),
  minPoints: z.coerce.number().optional(),
  maxPoints: z.coerce.number().optional(),
  activeWithin: z.coerce.number().optional(),
  createdAfter: z.string().optional().transform((s) => s ? new Date(s) : undefined),
  createdBefore: z.string().optional().transform((s) => s ? new Date(s) : undefined),
});

/**
 * GET /api/admin/analytics/export/csv
 * ANALYTICS-08: Export members to CSV
 */
adminAnalyticsRouter.get('/export/csv', async (req, res) => {
  const filters = exportFiltersSchema.parse(req.query);
  await exportMembersToCsv(res, filters);
});

/**
 * GET /api/admin/analytics/export/json
 * ANALYTICS-08: Export members to JSON
 */
adminAnalyticsRouter.get('/export/json', async (req, res) => {
  const filters = exportFiltersSchema.parse(req.query);
  await exportMembersToJson(res, filters);
});
