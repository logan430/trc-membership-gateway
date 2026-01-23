/**
 * Background job type definitions
 * Types for sync job results, statistics, and streak tracking
 */

/**
 * Result of syncing a single member's MEE6 XP
 */
export interface SyncResult {
  memberId: string;
  discordId: string;
  xpBefore: number | null; // null if first sync
  xpAfter: number;
  xpDelta: number;
  pointsAwarded: number;
  leftoverXp: number;
  isFirstSync: boolean;
}

/**
 * Statistics from a complete MEE6 XP sync run
 */
export interface SyncStats {
  totalMembers: number; // TRC members with Discord linked
  membersInMee6: number; // Found in MEE6 leaderboard
  membersNotInMee6: number; // Not found, created zero-XP record
  pointsAwarded: number; // Total points awarded across all members
  pointsDeducted: number; // Total negative points (XP decreases)
  firstSyncs: number; // Baseline records created (first sync for member)
  errors: number; // Individual member sync failures
  syncId: string;
  startedAt: Date;
  completedAt: Date;
}

/**
 * Statistics from daily streak calculation job
 * (Used by Plan 30-03)
 */
export interface StreakStats {
  membersProcessed: number;
  streaksIncremented: number;
  streaksReset: number;
  errors: number;
}
