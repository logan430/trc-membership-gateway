/**
 * Admin points config routes - point value configuration
 * Point config changes require ADMIN role (SUPER_ADMIN for seeding)
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireSuperAdmin } from '../../admin/middleware.js';
import {
  getAllPointConfigs,
  updatePointConfig,
  seedDefaultPointConfigs,
  invalidateConfigCache,
} from '../../points/config.js';
import { logAuditEvent } from '../../lib/audit.js';
import { prisma } from '../../lib/prisma.js';

export const adminPointsConfigRouter = Router();

// Audit action for point config changes
const POINT_CONFIG_UPDATED = 'POINT_CONFIG_UPDATED';
const POINT_CONFIGS_SEEDED = 'POINT_CONFIGS_SEEDED';

/**
 * GET /api/admin/points-config
 * List all point configs with their current values
 */
adminPointsConfigRouter.get('/', requireAdmin, async (req, res) => {
  const configs = await getAllPointConfigs();
  res.json({ configs });
});

// Schema for config update
const updateConfigSchema = z.object({
  points: z.number().int().min(0),
  enabled: z.boolean(),
  label: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
});

/**
 * PUT /api/admin/points-config/:action
 * Update a specific point action config
 */
adminPointsConfigRouter.put('/:action', requireAdmin, async (req, res) => {
  const action = req.params.action as string;
  const admin = res.locals.admin!;

  try {
    const data = updateConfigSchema.parse(req.body);

    // Get current config for comparison
    const currentConfig = await prisma.pointConfig.findUnique({
      where: { action },
    });

    if (!currentConfig) {
      res.status(404).json({ error: 'Point config not found', action });
      return;
    }

    const previousValue = {
      points: currentConfig.points,
      enabled: currentConfig.enabled,
      label: currentConfig.label,
      description: currentConfig.description,
    };

    // Update config
    const updated = await updatePointConfig(action, data, admin.id);

    // Log audit event
    await logAuditEvent({
      action: POINT_CONFIG_UPDATED,
      entityType: 'FeatureFlag', // Reuse FeatureFlag entity type for config
      entityId: action,
      details: {
        previousValue,
        newValue: {
          points: updated.points,
          enabled: updated.enabled,
          label: updated.label,
          description: updated.description,
        },
      },
      performedBy: admin.id,
    });

    res.json({
      success: true,
      config: updated,
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
 * POST /api/admin/points-config/seed
 * Seed default point configs (super admin only)
 */
adminPointsConfigRouter.post(
  '/seed',
  requireAdmin,
  requireSuperAdmin,
  async (req, res) => {
    const admin = res.locals.admin!;

    await seedDefaultPointConfigs();

    // Invalidate cache to pick up any new configs
    invalidateConfigCache();

    // Log audit event
    await logAuditEvent({
      action: POINT_CONFIGS_SEEDED,
      entityType: 'FeatureFlag', // Reuse FeatureFlag entity type for config
      entityId: 'all',
      details: { message: 'Default point configs seeded' },
      performedBy: admin.id,
    });

    res.json({
      success: true,
      message: 'Default point configs seeded',
    });
  }
);
