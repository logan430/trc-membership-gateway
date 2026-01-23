/**
 * MEE6 API types and Zod schemas
 * Types for the unofficial MEE6 leaderboard API
 */

import { z } from 'zod';

// ============================================================================
// Zod Schemas (runtime validation)
// ============================================================================

/**
 * MEE6 player data schema
 * Validates individual player entries from the leaderboard API
 */
export const mee6PlayerSchema = z.object({
  id: z.string(), // Discord user ID
  username: z.string(),
  discriminator: z.string(),
  avatar: z.string().nullable(),
  guild_id: z.string(),
  xp: z.number(), // Total XP
  level: z.number(),
  message_count: z.number(),
  // [currentLevelXp, xpToNextLevel, totalXp]
  detailed_xp: z.tuple([z.number(), z.number(), z.number()]),
});

/**
 * MEE6 guild data schema
 */
export const mee6GuildSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
  premium: z.boolean().optional(),
});

/**
 * MEE6 role reward schema
 */
export const mee6RoleRewardSchema = z.object({
  rank: z.number(),
  role: z.object({
    id: z.string(),
    name: z.string(),
  }),
});

/**
 * MEE6 leaderboard API response schema
 * Full response from GET /api/plugins/levels/leaderboard/{guildId}
 */
export const mee6LeaderboardSchema = z.object({
  admin: z.boolean().optional(),
  banner_url: z.string().nullable().optional(),
  guild: mee6GuildSchema,
  page: z.number(),
  player: z.unknown().nullable().optional(), // Current user's data if authenticated
  players: z.array(mee6PlayerSchema),
  role_rewards: z.array(mee6RoleRewardSchema).optional(),
  user_guild_settings: z.unknown().nullable().optional(),
  xp_per_message: z.tuple([z.number(), z.number()]).optional(), // [min, max] e.g., [15, 25]
  xp_rate: z.number().optional(), // XP multiplier e.g., 1.0
});

// ============================================================================
// TypeScript Types (derived from schemas)
// ============================================================================

/**
 * MEE6 player data
 * Individual player entry from the leaderboard
 */
export type Mee6Player = z.infer<typeof mee6PlayerSchema>;

/**
 * MEE6 guild data
 */
export type Mee6Guild = z.infer<typeof mee6GuildSchema>;

/**
 * MEE6 role reward configuration
 */
export type Mee6RoleReward = z.infer<typeof mee6RoleRewardSchema>;

/**
 * MEE6 leaderboard API response
 */
export type Mee6LeaderboardResponse = z.infer<typeof mee6LeaderboardSchema>;

// ============================================================================
// Client-side types (for internal use)
// ============================================================================

/**
 * Simplified XP data for a member
 * Used by sync job and returned from fetchAllMemberXp
 */
export interface MemberXpData {
  xp: number;
  level: number;
  messageCount: number;
}

/**
 * Result of fetching all member XP data
 * Map of Discord ID to XP data
 */
export type MemberXpMap = Map<string, MemberXpData>;
