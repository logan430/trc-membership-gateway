/**
 * Point action type constants and type definitions
 * Matches PointTransaction.action values in database
 */

// Point action type constants - matches PointTransaction.action values
export const PointAction = {
  BENCHMARK_SUBMISSION: 'benchmark_submission',
  RESOURCE_DOWNLOAD: 'resource_download',
  DISCORD_ACTIVITY: 'discord_activity',
  INTRO_COMPLETED: 'intro_completed',
  ADMIN_ADJUSTMENT: 'admin_adjustment',
} as const;

export type PointActionType = (typeof PointAction)[keyof typeof PointAction];

// Human-readable labels for UI display
export const PointActionLabels: Record<PointActionType, string> = {
  benchmark_submission: 'Benchmark Submission',
  resource_download: 'Resource Download',
  discord_activity: 'Discord Activity',
  intro_completed: 'Introduction Completed',
  admin_adjustment: 'Admin Adjustment',
};

// Configurable actions (admin_adjustment is not configurable - always manual)
export const CONFIGURABLE_ACTIONS = [
  PointAction.BENCHMARK_SUBMISSION,
  PointAction.RESOURCE_DOWNLOAD,
  PointAction.DISCORD_ACTIVITY,
  PointAction.INTRO_COMPLETED,
] as const;

export type ConfigurableActionType = (typeof CONFIGURABLE_ACTIONS)[number];
