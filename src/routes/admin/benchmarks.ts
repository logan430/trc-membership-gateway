/**
 * Admin benchmark moderation API routes
 * Endpoints for reviewing flagged submissions and viewing stats
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../../admin/middleware.js';
import { prisma } from '../../lib/prisma.js';
import { logAuditEvent, AuditAction } from '../../lib/audit.js';
import { BenchmarkCategory } from '@prisma/client';

export const adminBenchmarksRouter = Router();

// Schema for flagged submissions query
const flaggedQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  category: z.enum(['COMPENSATION', 'INFRASTRUCTURE', 'BUSINESS', 'OPERATIONAL']).optional(),
});

/**
 * GET /api/admin/benchmarks/flagged
 * Get paginated list of flagged (isValid = false) benchmark submissions
 * Includes member info for context
 * Optional category filter
 */
adminBenchmarksRouter.get('/flagged', requireAdmin, async (req, res) => {
  const query = flaggedQuerySchema.parse(req.query);

  const submissions = await prisma.benchmarkSubmission.findMany({
    take: query.limit + 1,
    skip: query.cursor ? 1 : 0,
    cursor: query.cursor ? { id: query.cursor } : undefined,
    where: {
      isValid: false,
      ...(query.category ? { category: query.category as BenchmarkCategory } : {}),
    },
    include: {
      member: {
        select: { id: true, email: true, discordUsername: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const hasMore = submissions.length > query.limit;
  const results = hasMore ? submissions.slice(0, query.limit) : submissions;

  res.json({
    submissions: results,
    nextCursor: hasMore ? results[results.length - 1].id : null,
    hasMore,
  });
});

// Schema for review action
const reviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
});

/**
 * POST /api/admin/benchmarks/:id/review
 * Approve or reject a flagged submission
 * Logs audit event for accountability
 */
adminBenchmarksRouter.post('/:id/review', requireAdmin, async (req, res) => {
  const { id } = z.object({ id: z.string() }).parse(req.params);
  const { action } = reviewSchema.parse(req.body);
  const admin = res.locals.admin!;

  const submission = await prisma.benchmarkSubmission.findUnique({
    where: { id },
  });

  if (!submission) {
    res.status(404).json({ error: 'Submission not found' });
    return;
  }

  // Update isValid based on action
  await prisma.benchmarkSubmission.update({
    where: { id },
    data: { isValid: action === 'approve' },
  });

  // Log audit event
  await logAuditEvent({
    action: AuditAction.BENCHMARK_REVIEWED,
    entityType: 'Member',
    entityId: submission.memberId,
    details: {
      submissionId: id,
      category: submission.category,
      action,
      reviewedBy: admin.id,
    },
    performedBy: admin.id,
  });

  res.json({ success: true });
});

/**
 * GET /api/admin/benchmarks/stats
 * Get submission statistics by category
 * Returns total, valid, and flagged counts per category
 */
adminBenchmarksRouter.get('/stats', requireAdmin, async (req, res) => {
  const categories: BenchmarkCategory[] = ['COMPENSATION', 'INFRASTRUCTURE', 'BUSINESS', 'OPERATIONAL'];

  const stats = await Promise.all(
    categories.map(async (category) => {
      const [total, valid, flagged] = await Promise.all([
        prisma.benchmarkSubmission.count({ where: { category } }),
        prisma.benchmarkSubmission.count({ where: { category, isValid: true } }),
        prisma.benchmarkSubmission.count({ where: { category, isValid: false } }),
      ]);
      return { category, total, valid, flagged };
    })
  );

  const totals = {
    total: stats.reduce((sum, s) => sum + s.total, 0),
    valid: stats.reduce((sum, s) => sum + s.valid, 0),
    flagged: stats.reduce((sum, s) => sum + s.flagged, 0),
  };

  res.json({ stats, totals });
});
