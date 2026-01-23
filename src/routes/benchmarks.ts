/**
 * Member-facing benchmark API routes
 * Endpoints for submitting benchmarks, viewing submissions, and querying aggregates
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthenticatedRequest } from '../middleware/session.js';
import {
  submitBenchmark,
  getMySubmissions,
  getAggregates,
} from '../benchmarks/service.js';
import { BenchmarkCategory } from '@prisma/client';

export const benchmarksRouter = Router();

// Schema for benchmark submission
const submitSchema = z.object({
  category: z.enum(['COMPENSATION', 'INFRASTRUCTURE', 'BUSINESS', 'OPERATIONAL']),
  data: z.record(z.string(), z.unknown()),
});

/**
 * POST /api/benchmarks/submit
 * Submit benchmark data for a category
 * Returns submission status, any outlier fields detected, and points awarded
 */
benchmarksRouter.post('/submit', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { category, data } = submitSchema.parse(req.body);
    const memberId = req.memberId!;

    const result = await submitBenchmark(memberId, category as BenchmarkCategory, data);

    res.json({
      submission: result.submission,
      outlierFields: result.outlierFields.length > 0 ? result.outlierFields : undefined,
      pointsAwarded: result.pointsAwarded,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.issues });
      return;
    }
    throw error;
  }
});

/**
 * GET /api/benchmarks/my-submissions
 * Get all benchmark submissions for the authenticated member
 * Returns array of submissions with id, category, data, isValid, submittedAt, updatedAt
 */
benchmarksRouter.get('/my-submissions', requireAuth, async (req: AuthenticatedRequest, res) => {
  const memberId = req.memberId!;
  const submissions = await getMySubmissions(memberId);
  res.json({ submissions });
});

// Schema for aggregates query parameters
const aggregatesQuerySchema = z.object({
  companySize: z.string().optional(),
  industry: z.string().optional(),
});

/**
 * GET /api/benchmarks/aggregates/:category
 * Get aggregate statistics for a benchmark category
 * Returns available fields (with 5+ submissions) and insufficient fields (< 5 submissions)
 * Optional query params: companySize, industry for segment filtering
 */
benchmarksRouter.get('/aggregates/:category', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const category = z.enum(['COMPENSATION', 'INFRASTRUCTURE', 'BUSINESS', 'OPERATIONAL'])
      .parse(req.params.category);
    const filters = aggregatesQuerySchema.parse(req.query);
    const memberId = req.memberId!;

    const result = await getAggregates(
      category as BenchmarkCategory,
      memberId,
      Object.keys(filters).length > 0 ? filters : undefined
    );

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid category', details: error.issues });
      return;
    }
    throw error;
  }
});
