/**
 * Feature flag service with in-memory caching
 * Flags are stored in database and cached for 1 minute
 */
import { prisma } from './prisma.js';

/**
 * Known feature flag keys
 * - require_introduction: Whether intro is required for full access
 * - send_claim_reminders: Whether claim reminder emails are sent
 * - send_billing_emails: Whether billing failure/recovery emails sent
 * - send_invite_emails: Whether team invite emails sent
 * - auto_fix_reconciliation: Whether reconciliation auto-fixes drift
 * - enable_magic_links: Whether magic link login is available
 * - enable_team_signups: Whether company plan signups are enabled
 * - maintenance_mode: Blocks all non-admin operations
 */
export type FeatureFlagKey =
  | 'require_introduction'
  | 'send_claim_reminders'
  | 'send_billing_emails'
  | 'send_invite_emails'
  | 'auto_fix_reconciliation'
  | 'enable_magic_links'
  | 'enable_team_signups'
  | 'maintenance_mode';

// In-memory cache for feature flags
let flagCache: Map<string, boolean> | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 60_000; // 1 minute per RESEARCH.md

/**
 * Check if a feature flag is enabled
 * Uses in-memory cache with 1-minute TTL
 * Returns false if flag doesn't exist (default to disabled)
 */
export async function isFeatureEnabled(key: FeatureFlagKey): Promise<boolean> {
  // Check if cache is valid
  if (flagCache && Date.now() < cacheExpiry) {
    return flagCache.get(key) ?? false;
  }

  // Rebuild cache from database
  const flags = await prisma.featureFlag.findMany();
  flagCache = new Map(flags.map((f) => [f.key, f.enabled]));
  cacheExpiry = Date.now() + CACHE_TTL;

  return flagCache.get(key) ?? false;
}

/**
 * Get all feature flags (fresh from database, no cache)
 * Used by admin panel for flag management
 */
export async function getAllFlags(): Promise<
  Array<{
    key: string;
    enabled: boolean;
    description: string | null;
    category: string;
    updatedAt: Date;
  }>
> {
  const flags = await prisma.featureFlag.findMany({
    orderBy: [{ category: 'asc' }, { key: 'asc' }],
    select: {
      key: true,
      enabled: true,
      description: true,
      category: true,
      updatedAt: true,
    },
  });
  return flags;
}

/**
 * Update a feature flag
 * Invalidates cache immediately after update
 */
export async function setFlag(
  key: string,
  enabled: boolean,
  adminId: string
): Promise<void> {
  await prisma.featureFlag.upsert({
    where: { key },
    update: {
      enabled,
      updatedBy: adminId,
    },
    create: {
      key,
      enabled,
      updatedBy: adminId,
    },
  });

  // Invalidate cache immediately
  invalidateFlagCache();
}

/**
 * Invalidate the feature flag cache
 * Called after flag updates to ensure changes take effect immediately
 */
export function invalidateFlagCache(): void {
  flagCache = null;
  cacheExpiry = 0;
}

/**
 * Default feature flag definitions
 */
const DEFAULT_FLAGS: Array<{
  key: FeatureFlagKey;
  enabled: boolean;
  description: string;
  category: string;
}> = [
  {
    key: 'require_introduction',
    enabled: true,
    description: 'Require introduction message before granting full access',
    category: 'onboarding',
  },
  {
    key: 'send_claim_reminders',
    enabled: true,
    description: 'Send reminder emails to members who haven\'t claimed Discord access',
    category: 'email',
  },
  {
    key: 'send_billing_emails',
    enabled: true,
    description: 'Send billing failure and recovery notification emails',
    category: 'email',
  },
  {
    key: 'send_invite_emails',
    enabled: true,
    description: 'Send team seat invitation emails',
    category: 'email',
  },
  {
    key: 'auto_fix_reconciliation',
    enabled: false,
    description: 'Automatically fix drift issues detected during reconciliation',
    category: 'operations',
  },
  {
    key: 'enable_magic_links',
    enabled: true,
    description: 'Enable magic link login for passwordless authentication',
    category: 'auth',
  },
  {
    key: 'enable_team_signups',
    enabled: true,
    description: 'Allow new company plan signups',
    category: 'billing',
  },
  {
    key: 'maintenance_mode',
    enabled: false,
    description: 'Block all non-admin operations (maintenance mode)',
    category: 'general',
  },
];

/**
 * Seed default feature flags
 * Uses createMany with skipDuplicates so existing flags are preserved
 */
export async function seedDefaultFlags(): Promise<void> {
  await prisma.featureFlag.createMany({
    data: DEFAULT_FLAGS,
    skipDuplicates: true,
  });
}
