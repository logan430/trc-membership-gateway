import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireAdmin } from '../../admin/middleware.js';
import { logAuditEvent, AuditAction } from '../../lib/audit.js';
import { removeAllManagedRoles, addRoleToMember } from '../../bot/roles.js';
import { discordClient } from '../../bot/client.js';
import { env } from '../../config/env.js';
import { logger } from '../../index.js';

export const adminAccessRouter = Router();

// Common schema for reason field (required for all destructive actions)
const reasonSchema = z.object({
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
});

// Schema for member ID parameter
const memberIdSchema = z.object({
  id: z.string(),
});

// Schema for grant role action
const grantRoleSchema = z.object({
  role: z.enum(['Squire', 'Knight', 'Lord', 'Debtor']),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
});

// Schema for bulk revoke action
const bulkRevokeSchema = z.object({
  memberIds: z.array(z.string()).min(1).max(50),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
});

/**
 * Check if Discord bot is online and guild is accessible
 */
function isBotOnline(): boolean {
  const guild = discordClient.guilds.cache.get(env.DISCORD_GUILD_ID);
  return Boolean(guild);
}

/**
 * Delay helper for rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * POST /admin/members/:id/revoke-access
 * Remove Discord roles but keep subscription and member record
 * Per CONTEXT.md: Do NOT kick from server
 */
adminAccessRouter.post('/:id/revoke-access', requireAdmin, async (req, res) => {
  try {
    const { id } = memberIdSchema.parse(req.params);
    const { reason } = reasonSchema.parse(req.body);
    const admin = res.locals.admin!;

    // Find member
    const member = await prisma.member.findUnique({
      where: { id },
    });

    if (!member) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    if (!member.discordId) {
      res.status(400).json({ error: 'Member has no Discord linked' });
      return;
    }

    // Check if bot is online
    if (!isBotOnline()) {
      res.status(503).json({ error: 'Discord bot is not connected' });
      return;
    }

    // Remove all managed roles (Squire, Knight, Lord, Debtor)
    const success = await removeAllManagedRoles(member.discordId);

    if (!success) {
      res.status(500).json({ error: 'Failed to remove Discord roles' });
      return;
    }

    // Log audit event
    await logAuditEvent({
      action: AuditAction.MEMBER_ACCESS_REVOKED,
      entityType: 'Member',
      entityId: id,
      details: {
        discordId: member.discordId,
        discordUsername: member.discordUsername,
      },
      performedBy: admin.id,
      reason,
    });

    logger.info(
      { memberId: id, adminId: admin.id, reason },
      'Admin revoked member Discord access'
    );

    res.json({ success: true, message: 'Discord access revoked' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.issues });
      return;
    }
    throw error;
  }
});

/**
 * POST /admin/members/:id/reset-claim
 * Unlink Discord but keep subscription
 * Per CONTEXT.md: Keep introCompleted as-is
 */
adminAccessRouter.post('/:id/reset-claim', requireAdmin, async (req, res) => {
  try {
    const { id } = memberIdSchema.parse(req.params);
    const { reason } = reasonSchema.parse(req.body);
    const admin = res.locals.admin!;

    // Find member
    const member = await prisma.member.findUnique({
      where: { id },
    });

    if (!member) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    if (!member.discordId) {
      res.status(400).json({ error: 'Member has no Discord linked' });
      return;
    }

    // Check if bot is online
    if (!isBotOnline()) {
      res.status(503).json({ error: 'Discord bot is not connected' });
      return;
    }

    // Remove Discord roles first
    await removeAllManagedRoles(member.discordId);

    // Store old Discord info for audit log
    const oldDiscordId = member.discordId;
    const oldDiscordUsername = member.discordUsername;

    // Update member: unlink Discord but keep subscription and intro status
    await prisma.member.update({
      where: { id },
      data: {
        discordId: null,
        discordUsername: null,
        discordAvatar: null,
        // Per CONTEXT.md: Keep introCompleted as-is
      },
    });

    // Log audit event
    await logAuditEvent({
      action: AuditAction.MEMBER_CLAIM_RESET,
      entityType: 'Member',
      entityId: id,
      details: {
        oldDiscordId,
        oldDiscordUsername,
        introCompleted: member.introCompleted,
      },
      performedBy: admin.id,
      reason,
    });

    logger.info(
      { memberId: id, adminId: admin.id, reason },
      'Admin reset member Discord claim'
    );

    res.json({ success: true, message: 'Discord claim reset' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.issues });
      return;
    }
    throw error;
  }
});

/**
 * POST /admin/members/:id/grant-role
 * Assign a specific role directly, bypassing normal flow
 */
adminAccessRouter.post('/:id/grant-role', requireAdmin, async (req, res) => {
  try {
    const { id } = memberIdSchema.parse(req.params);
    const { role, reason } = grantRoleSchema.parse(req.body);
    const admin = res.locals.admin!;

    // Find member
    const member = await prisma.member.findUnique({
      where: { id },
    });

    if (!member) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    if (!member.discordId) {
      res.status(400).json({ error: 'Member has no Discord linked' });
      return;
    }

    // Check if bot is online
    if (!isBotOnline()) {
      res.status(503).json({ error: 'Discord bot is not connected' });
      return;
    }

    // Remove all managed roles first (clean slate)
    await removeAllManagedRoles(member.discordId);

    // Assign the requested role
    const success = await addRoleToMember(member.discordId, role);

    if (!success) {
      res.status(500).json({ error: 'Failed to assign Discord role' });
      return;
    }

    // Log audit event
    await logAuditEvent({
      action: AuditAction.MEMBER_ROLE_GRANTED,
      entityType: 'Member',
      entityId: id,
      details: {
        discordId: member.discordId,
        discordUsername: member.discordUsername,
        grantedRole: role,
      },
      performedBy: admin.id,
      reason,
    });

    logger.info(
      { memberId: id, adminId: admin.id, role, reason },
      'Admin granted member role'
    );

    res.json({ success: true, message: `Granted ${role} role` });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.issues });
      return;
    }
    throw error;
  }
});

/**
 * POST /admin/members/bulk-revoke
 * Revoke access for multiple members with rate limiting
 * Per RESEARCH.md: Process in batches of 5 with 2-second delays
 */
adminAccessRouter.post('/bulk-revoke', requireAdmin, async (req, res) => {
  try {
    const { memberIds, reason } = bulkRevokeSchema.parse(req.body);
    const admin = res.locals.admin!;

    // Check if bot is online
    if (!isBotOnline()) {
      res.status(503).json({ error: 'Discord bot is not connected' });
      return;
    }

    // Fetch all members by IDs with discordId
    const members = await prisma.member.findMany({
      where: {
        id: { in: memberIds },
        discordId: { not: null },
      },
      select: {
        id: true,
        discordId: true,
        discordUsername: true,
      },
    });

    let processed = 0;
    let failed = 0;
    const BATCH_SIZE = 5;
    const BATCH_DELAY_MS = 2000;

    // Process in batches with delays for Discord rate limits
    for (let i = 0; i < members.length; i += BATCH_SIZE) {
      const batch = members.slice(i, i + BATCH_SIZE);

      // Process batch concurrently
      const results = await Promise.allSettled(
        batch.map(async (member) => {
          if (!member.discordId) return false;

          const success = await removeAllManagedRoles(member.discordId);

          if (success) {
            // Log audit event for each member
            await logAuditEvent({
              action: AuditAction.MEMBER_ACCESS_REVOKED,
              entityType: 'Member',
              entityId: member.id,
              details: {
                discordId: member.discordId,
                discordUsername: member.discordUsername,
                bulkAction: true,
              },
              performedBy: admin.id,
              reason,
            });
          }

          return success;
        })
      );

      // Count results
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          processed++;
        } else {
          failed++;
        }
      }

      // Delay before next batch (except for last batch)
      if (i + BATCH_SIZE < members.length) {
        await delay(BATCH_DELAY_MS);
      }
    }

    // Log bulk action summary
    await logAuditEvent({
      action: AuditAction.BULK_ACTION_PERFORMED,
      entityType: 'Member',
      entityId: 'bulk',
      details: {
        action: 'bulk-revoke',
        requestedCount: memberIds.length,
        processedCount: processed,
        failedCount: failed,
        memberIds: memberIds,
      },
      performedBy: admin.id,
      reason,
    });

    logger.info(
      { adminId: admin.id, requested: memberIds.length, processed, failed, reason },
      'Admin performed bulk revoke'
    );

    res.json({ success: true, processed, failed });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.issues });
      return;
    }
    throw error;
  }
});
