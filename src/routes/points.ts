/**
 * Member-facing points API routes
 * Endpoints for viewing point history, values, and summary
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthenticatedRequest } from '../middleware/session.js';
import { prisma } from '../lib/prisma.js';
import { getAllPointConfigs } from '../points/config.js';
import { PointAction, PointActionLabels, type PointActionType } from '../points/types.js';

export const pointsRouter = Router();

// Query schema for history endpoint
const historyQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  type: z.string().optional(),
});

/**
 * GET /api/points/history
 * Get paginated point transaction history for authenticated member
 * Excludes admin_adjustment transactions (hidden from member view)
 */
pointsRouter.get('/history', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const query = historyQuerySchema.parse(req.query);
    const memberId = req.memberId!;

    // Build where clause - ALWAYS exclude admin_adjustment
    const where = {
      memberId,
      action: { not: PointAction.ADMIN_ADJUSTMENT },
      ...(query.type ? { action: query.type } : {}),
    };

    // Fetch transactions with cursor pagination
    const transactions = await prisma.pointTransaction.findMany({
      take: query.limit + 1, // Fetch one extra to detect hasMore
      skip: query.cursor ? 1 : 0,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        action: true,
        points: true,
        metadata: true,
        createdAt: true,
      },
    });

    const hasMore = transactions.length > query.limit;
    const results = hasMore ? transactions.slice(0, query.limit) : transactions;
    const nextCursor = hasMore ? results[results.length - 1].id : null;

    // Map to response format with action labels
    const mappedTransactions = results.map((t) => ({
      id: t.id,
      action: t.action,
      actionLabel: PointActionLabels[t.action as PointActionType] || t.action,
      points: t.points,
      metadata: t.metadata as Record<string, unknown>,
      createdAt: t.createdAt,
    }));

    res.json({
      transactions: mappedTransactions,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid query parameters', details: error.issues });
      return;
    }
    throw error;
  }
});

/**
 * GET /api/points/values
 * Get enabled point action values for transparency
 * Shows members how many points each action is worth
 */
pointsRouter.get('/values', requireAuth, async (_req, res) => {
  // Get all configs from database (fresh, not cached)
  const configs = await getAllPointConfigs();

  // Filter to only enabled configs, exclude admin_adjustment
  const enabledConfigs = configs.filter(
    (c) => c.enabled && c.action !== PointAction.ADMIN_ADJUSTMENT
  );

  // Sort by points descending (highest value actions first)
  enabledConfigs.sort((a, b) => b.points - a.points);

  // Map to response format
  const values = enabledConfigs.map((c) => ({
    action: c.action,
    label: c.label,
    points: c.points,
    description: c.description || undefined,
  }));

  res.json({ values });
});

/**
 * GET /api/points/summary
 * Get total points, streak, and breakdown by action type for authenticated member
 * Excludes admin_adjustment from breakdown (hidden from member view)
 */
pointsRouter.get('/summary', requireAuth, async (req: AuthenticatedRequest, res) => {
  const memberId = req.memberId!;

  // Get member's total points and streak
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { totalPoints: true, currentStreak: true },
  });

  if (!member) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  // Get breakdown by action type, excluding admin_adjustment
  const breakdown = await prisma.pointTransaction.groupBy({
    by: ['action'],
    where: {
      memberId,
      action: { not: PointAction.ADMIN_ADJUSTMENT },
    },
    _sum: { points: true },
  });

  // Map to response format with labels
  const mappedBreakdown = breakdown.map((b) => ({
    action: b.action,
    actionLabel: PointActionLabels[b.action as PointActionType] || b.action,
    points: b._sum.points || 0,
  }));

  res.json({
    totalPoints: Math.max(0, member.totalPoints), // Floor at zero for display
    currentStreak: member.currentStreak,
    breakdown: mappedBreakdown,
  });
});
