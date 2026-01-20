/**
 * Admin audit log routes - query and filter audit logs
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../../admin/middleware.js';
import { prisma } from '../../lib/prisma.js';
import type { Prisma } from '@prisma/client';

export const adminAuditRouter = Router();

// Query schema for audit logs
const auditQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  action: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  performedBy: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  search: z.string().optional(),
});

/**
 * GET /admin/audit
 * List audit logs with filtering and pagination
 */
adminAuditRouter.get('/', requireAdmin, async (req, res) => {
  try {
    const query = auditQuerySchema.parse(req.query);

    // Build where clause with filters
    const where: Prisma.AuditLogWhereInput = {
      AND: [
        query.action ? { action: query.action } : {},
        query.entityType ? { entityType: query.entityType } : {},
        query.entityId ? { entityId: query.entityId } : {},
        query.performedBy ? { performedBy: query.performedBy } : {},
        query.startDate ? { createdAt: { gte: query.startDate } } : {},
        query.endDate ? { createdAt: { lte: query.endDate } } : {},
      ],
    };

    // Fetch logs with cursor pagination
    const logs = await prisma.auditLog.findMany({
      take: query.limit + 1, // Fetch one extra to detect hasMore
      skip: query.cursor ? 1 : 0,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      where,
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = logs.length > query.limit;
    const results = hasMore ? logs.slice(0, query.limit) : logs;
    const nextCursor = hasMore ? results[results.length - 1].id : null;

    res.json({
      logs: results,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
      return;
    }
    throw error;
  }
});

/**
 * GET /admin/audit/actions
 * Get distinct action types for filter dropdown
 */
adminAuditRouter.get('/actions', requireAdmin, async (req, res) => {
  const actions = await prisma.auditLog.findMany({
    distinct: ['action'],
    select: { action: true },
    orderBy: { action: 'asc' },
  });

  res.json({
    actions: actions.map((a) => a.action),
  });
});

/**
 * GET /admin/audit/entity-types
 * Get distinct entity types for filter dropdown
 */
adminAuditRouter.get('/entity-types', requireAdmin, async (req, res) => {
  const entityTypes = await prisma.auditLog.findMany({
    distinct: ['entityType'],
    select: { entityType: true },
    orderBy: { entityType: 'asc' },
  });

  res.json({
    entityTypes: entityTypes.map((e) => e.entityType),
  });
});
