/**
 * Admin points management API routes
 * Endpoints for adjusting member points and viewing full history
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../../admin/middleware.js';
import { prisma } from '../../lib/prisma.js';
import { adminAdjustPoints } from '../../points/service.js';
import { PointActionLabels, type PointActionType } from '../../points/types.js';

export const adminPointsRouter = Router();

// Schema for member ID parameter
const memberIdSchema = z.object({
  id: z.string(),
});

// Schema for adjust points body
const adjustPointsSchema = z.object({
  points: z.number().int(),
  reason: z.string().optional(),
  notifyMember: z.boolean().default(false),
});

// Query schema for history endpoint
const historyQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

/**
 * POST /api/admin/members/:id/points/adjust
 * Adjust member points (can be positive or negative)
 * Creates audit trail and optionally notifies member via Discord DM
 */
adminPointsRouter.post('/:id/points/adjust', requireAdmin, async (req, res) => {
  try {
    const { id } = memberIdSchema.parse(req.params);
    const { points, reason, notifyMember } = adjustPointsSchema.parse(req.body);
    const admin = res.locals.admin!;

    // Validate member exists
    const member = await prisma.member.findUnique({
      where: { id },
      select: { id: true, totalPoints: true },
    });

    if (!member) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    // Adjust points (service handles transaction creation and audit logging)
    await adminAdjustPoints({
      memberId: id,
      points,
      reason,
      notifyMember,
      adminId: admin.id,
    });

    // Get updated total
    const updatedMember = await prisma.member.findUnique({
      where: { id },
      select: { totalPoints: true },
    });

    res.json({
      success: true,
      newTotal: updatedMember?.totalPoints ?? member.totalPoints + points,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.issues });
      return;
    }
    throw error;
  }
});

/**
 * GET /api/admin/members/:id/points/history
 * Get full point transaction history for a member
 * Unlike member endpoint, this INCLUDES admin_adjustment transactions
 */
adminPointsRouter.get('/:id/points/history', requireAdmin, async (req, res) => {
  try {
    const { id } = memberIdSchema.parse(req.params);
    const query = historyQuerySchema.parse(req.query);

    // Validate member exists
    const member = await prisma.member.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!member) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    // Fetch ALL transactions (including admin_adjustment)
    const transactions = await prisma.pointTransaction.findMany({
      take: query.limit + 1, // Fetch one extra to detect hasMore
      skip: query.cursor ? 1 : 0,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      where: { memberId: id },
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
