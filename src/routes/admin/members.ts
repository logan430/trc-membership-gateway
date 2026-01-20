import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireAdmin } from '../../admin/middleware.js';
import { getEntityAuditLogs } from '../../lib/audit.js';
import type { Prisma } from '@prisma/client';

export const adminMembersRouter = Router();

// Query schema for member listing with cursor-based pagination
const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  search: z.string().optional(), // Searches email AND discordUsername
  subscriptionStatus: z.enum(['NONE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED']).optional(),
  seatTier: z.enum(['INDIVIDUAL', 'OWNER', 'TEAM_MEMBER']).optional(),
  hasDiscord: z.enum(['true', 'false']).optional(), // Filter by discordId null/not null
  introCompleted: z.enum(['true', 'false']).optional(),
});

/**
 * GET /admin/members
 * List all members with pagination, search, and filtering
 */
adminMembersRouter.get('/', requireAdmin, async (req, res) => {
  try {
    const query = listQuerySchema.parse(req.query);

    // Build where clause with AND conditions for all filters
    const conditions: Prisma.MemberWhereInput[] = [];

    // Search by email OR discordUsername
    if (query.search) {
      conditions.push({
        OR: [
          { email: { contains: query.search, mode: 'insensitive' } },
          { discordUsername: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    // Filter by subscription status
    if (query.subscriptionStatus) {
      conditions.push({ subscriptionStatus: query.subscriptionStatus });
    }

    // Filter by seat tier
    if (query.seatTier) {
      conditions.push({ seatTier: query.seatTier });
    }

    // Filter by Discord linked status
    if (query.hasDiscord === 'true') {
      conditions.push({ discordId: { not: null } });
    } else if (query.hasDiscord === 'false') {
      conditions.push({ discordId: null });
    }

    // Filter by intro completion
    if (query.introCompleted === 'true') {
      conditions.push({ introCompleted: true });
    } else if (query.introCompleted === 'false') {
      conditions.push({ introCompleted: false });
    }

    const where: Prisma.MemberWhereInput = conditions.length > 0
      ? { AND: conditions }
      : {};

    // Cursor-based pagination per RESEARCH.md
    const members = await prisma.member.findMany({
      take: query.limit + 1, // Fetch one extra to detect hasMore
      skip: query.cursor ? 1 : 0,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        discordId: true,
        discordUsername: true,
        subscriptionStatus: true,
        seatTier: true,
        introCompleted: true,
        createdAt: true,
        teamId: true,
      },
    });

    // Calculate pagination info
    const hasMore = members.length > query.limit;
    const results = hasMore ? members.slice(0, query.limit) : members;
    const nextCursor = hasMore && results.length > 0
      ? results[results.length - 1].id
      : null;

    // Get total count for display
    const total = await prisma.member.count({ where });

    res.json({
      members: results,
      nextCursor,
      hasMore,
      total,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid query parameters', details: error.issues });
      return;
    }
    throw error;
  }
});

// Schema for member ID parameter
const memberIdSchema = z.object({
  id: z.string(),
});

/**
 * GET /admin/members/:id
 * Get detailed member info including team and audit history
 */
adminMembersRouter.get('/:id', requireAdmin, async (req, res) => {
  const { id } = memberIdSchema.parse(req.params);

  // Find member with full fields
  const member = await prisma.member.findUnique({
    where: { id },
    include: {
      team: true, // Include team if exists
    },
  });

  if (!member) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  // Get recent audit logs for this member
  const auditLogs = await getEntityAuditLogs('Member', id);

  res.json({
    member,
    team: member.teamId ? member.team : null,
    auditLogs,
  });
});
