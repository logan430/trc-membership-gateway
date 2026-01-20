/**
 * Admin config routes - feature flags and system configuration
 * Feature flag changes require SUPER_ADMIN role
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireSuperAdmin } from '../../admin/middleware.js';
import { getAllFlags, setFlag, seedDefaultFlags } from '../../lib/feature-flags.js';
import { logAuditEvent, AuditAction } from '../../lib/audit.js';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';

export const adminConfigRouter = Router();

/**
 * GET /admin/config/feature-flags
 * List all feature flags with their current state
 */
adminConfigRouter.get('/feature-flags', requireAdmin, async (req, res) => {
  const flags = await getAllFlags();
  res.json({ flags });
});

// Schema for flag toggle
const toggleFlagSchema = z.object({
  enabled: z.boolean(),
});

/**
 * PATCH /admin/config/feature-flags/:key
 * Toggle a feature flag (super admin only)
 */
adminConfigRouter.patch(
  '/feature-flags/:key',
  requireAdmin,
  requireSuperAdmin,
  async (req, res) => {
    const { key } = req.params;
    const admin = res.locals.admin!;

    try {
      const { enabled } = toggleFlagSchema.parse(req.body);

      // Get current flag state for comparison
      const currentFlag = await prisma.featureFlag.findUnique({
        where: { key },
      });

      const previousValue = currentFlag?.enabled ?? null;

      // Update flag
      await setFlag(key, enabled, admin.id);

      // Log audit event
      await logAuditEvent({
        action: AuditAction.FEATURE_FLAG_TOGGLED,
        entityType: 'FeatureFlag',
        entityId: key,
        details: {
          previousValue,
          newValue: enabled,
        },
        performedBy: admin.id,
      });

      res.json({
        success: true,
        flag: { key, enabled },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid request', details: error.errors });
        return;
      }
      throw error;
    }
  }
);

/**
 * POST /admin/config/feature-flags/seed
 * Seed default feature flags (super admin only)
 */
adminConfigRouter.post(
  '/feature-flags/seed',
  requireAdmin,
  requireSuperAdmin,
  async (req, res) => {
    const admin = res.locals.admin!;

    await seedDefaultFlags();

    // Log audit event
    await logAuditEvent({
      action: AuditAction.FEATURE_FLAGS_SEEDED,
      entityType: 'FeatureFlag',
      entityId: 'all',
      details: { message: 'Default feature flags seeded' },
      performedBy: admin.id,
    });

    res.json({
      success: true,
      message: 'Default flags seeded',
    });
  }
);

/**
 * GET /admin/config/discord-channels
 * View current Discord channel IDs (read-only)
 * Channel IDs are configured via environment variables
 */
adminConfigRouter.get('/discord-channels', requireAdmin, async (req, res) => {
  res.json({
    channels: {
      introductions: env.DISCORD_INTRODUCTIONS_CHANNEL_ID || null,
      billingSupport: env.DISCORD_BILLING_SUPPORT_CHANNEL_ID || null,
      adminAlerts: env.DISCORD_ADMIN_CHANNEL_ID || null,
    },
    note: 'Channel IDs are configured via environment variables',
  });
});
