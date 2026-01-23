/**
 * Point configuration service with in-memory caching
 * Configs are stored in database and cached for 1 minute
 * Follows FeatureFlag caching pattern from src/lib/feature-flags.ts
 */
import { prisma } from '../lib/prisma.js';
import {
  PointAction,
  PointActionLabels,
  CONFIGURABLE_ACTIONS,
  type PointActionType,
  type ConfigurableActionType,
} from './types.js';

// In-memory cache for point configs
interface CachedConfig {
  points: number;
  enabled: boolean;
  label: string;
  description: string | null;
}

let configCache: Map<string, CachedConfig> | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 60_000; // 1 minute per FeatureFlag pattern

/**
 * Get point value for an action
 * Uses in-memory cache with 1-minute TTL
 * Returns 0 if action is disabled or not found
 */
export async function getPointValue(action: PointActionType): Promise<number> {
  const config = await getConfig(action);
  if (!config || !config.enabled) {
    return 0;
  }
  return config.points;
}

/**
 * Check if a point action is enabled
 * Uses in-memory cache with 1-minute TTL
 * Returns false if action doesn't exist
 */
export async function isActionEnabled(action: PointActionType): Promise<boolean> {
  const config = await getConfig(action);
  return config?.enabled ?? false;
}

/**
 * Get config for a specific action from cache
 */
async function getConfig(action: PointActionType): Promise<CachedConfig | null> {
  // Check if cache is valid
  if (configCache && Date.now() < cacheExpiry) {
    return configCache.get(action) ?? null;
  }

  // Rebuild cache from database
  const configs = await prisma.pointConfig.findMany();
  configCache = new Map(
    configs.map((c) => [
      c.action,
      {
        points: c.points,
        enabled: c.enabled,
        label: c.label,
        description: c.description,
      },
    ])
  );
  cacheExpiry = Date.now() + CACHE_TTL;

  return configCache.get(action) ?? null;
}

/**
 * Invalidate the point config cache
 * Called after config updates to ensure changes take effect immediately
 */
export function invalidateConfigCache(): void {
  configCache = null;
  cacheExpiry = 0;
}

/**
 * Get all point configs (fresh from database, no cache)
 * Used by admin panel for config management
 */
export async function getAllPointConfigs(): Promise<
  Array<{
    id: string;
    action: string;
    points: number;
    enabled: boolean;
    label: string;
    description: string | null;
    updatedAt: Date;
    updatedBy: string | null;
  }>
> {
  const configs = await prisma.pointConfig.findMany({
    orderBy: { action: 'asc' },
  });
  return configs;
}

/**
 * Update a point config
 * Invalidates cache immediately after update
 */
export async function updatePointConfig(
  action: string,
  data: {
    points: number;
    enabled: boolean;
    label?: string;
    description?: string | null;
  },
  adminId: string
): Promise<{
  id: string;
  action: string;
  points: number;
  enabled: boolean;
  label: string;
  description: string | null;
  updatedAt: Date;
  updatedBy: string | null;
}> {
  const config = await prisma.pointConfig.update({
    where: { action },
    data: {
      points: data.points,
      enabled: data.enabled,
      ...(data.label !== undefined && { label: data.label }),
      ...(data.description !== undefined && { description: data.description }),
      updatedBy: adminId,
    },
  });

  // Invalidate cache immediately
  invalidateConfigCache();

  return config;
}

/**
 * Default point config definitions
 * Values from CONTEXT.md:
 * - benchmark_submission: 50 points
 * - resource_download: 5 points
 * - discord_activity: 1 point (per 100 XP)
 * - intro_completed: 25 points
 */
const DEFAULT_CONFIGS: Array<{
  action: ConfigurableActionType;
  points: number;
  enabled: boolean;
  label: string;
  description: string | null;
}> = [
  {
    action: PointAction.BENCHMARK_SUBMISSION,
    points: 50,
    enabled: true,
    label: PointActionLabels[PointAction.BENCHMARK_SUBMISSION],
    description: 'Points awarded for submitting benchmark data',
  },
  {
    action: PointAction.RESOURCE_DOWNLOAD,
    points: 5,
    enabled: true,
    label: PointActionLabels[PointAction.RESOURCE_DOWNLOAD],
    description: 'Points awarded for downloading a resource',
  },
  {
    action: PointAction.DISCORD_ACTIVITY,
    points: 1,
    enabled: true,
    label: PointActionLabels[PointAction.DISCORD_ACTIVITY],
    description: 'Points awarded per 100 Discord XP synced from MEE6',
  },
  {
    action: PointAction.INTRO_COMPLETED,
    points: 25,
    enabled: true,
    label: PointActionLabels[PointAction.INTRO_COMPLETED],
    description: 'Points awarded for completing introduction',
  },
];

/**
 * Seed default point configs
 * Uses createMany with skipDuplicates so existing configs are preserved
 */
export async function seedDefaultPointConfigs(): Promise<void> {
  await prisma.pointConfig.createMany({
    data: DEFAULT_CONFIGS,
    skipDuplicates: true,
  });
}
