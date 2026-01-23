/**
 * MEE6 API Client
 * Fetches leaderboard data from the unofficial MEE6 API with retry logic
 */

import pRetry, { AbortError } from 'p-retry';
import * as Sentry from '@sentry/node';
import { logger } from '../index.js';
import { env } from '../config/env.js';
import {
  mee6LeaderboardSchema,
  type Mee6LeaderboardResponse,
  type MemberXpData,
  type MemberXpMap,
} from './types.js';

const MEE6_API_BASE = 'https://mee6.xyz/api/plugins/levels/leaderboard';

// Rate limit safety: delay between page fetches (milliseconds)
const PAGE_FETCH_DELAY_MS = 2000;

/**
 * Sleep utility for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a single page of the MEE6 leaderboard
 *
 * @param guildId - Discord guild ID (defaults to DISCORD_GUILD_ID from env)
 * @param page - Page number (0-indexed)
 * @param limit - Number of players per page (max 1000, recommended 500)
 * @returns Validated MEE6 leaderboard response
 * @throws AbortError if leaderboard not public (401)
 * @throws Error on rate limit (429) or other failures
 */
export async function fetchLeaderboardPage(
  guildId?: string,
  page: number = 0,
  limit: number = 100
): Promise<Mee6LeaderboardResponse> {
  const effectiveGuildId = guildId ?? env.DISCORD_GUILD_ID;

  return pRetry(
    async () => {
      const url = `${MEE6_API_BASE}/${effectiveGuildId}?page=${page}&limit=${limit}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'TRC-Gatekeeper/1.0',
          Accept: 'application/json',
        },
      });

      // 401 = leaderboard not public - abort, don't retry
      if (response.status === 401) {
        throw new AbortError(
          'MEE6 leaderboard not public. Enable "Make my server\'s leaderboard public" in MEE6 dashboard.'
        );
      }

      // 429 = rate limited - throw to trigger retry with backoff
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new Error(
          `MEE6 rate limited. Retry-After: ${retryAfter ?? 'unknown'}s`
        );
      }

      // Other errors
      if (!response.ok) {
        throw new Error(`MEE6 API error: ${response.status} ${response.statusText}`);
      }

      // Parse JSON response
      const data = await response.json();

      // Validate response structure with Zod
      const parseResult = mee6LeaderboardSchema.safeParse(data);

      if (!parseResult.success) {
        // Log validation error to Sentry
        Sentry.captureException(parseResult.error, {
          extra: {
            guildId: effectiveGuildId,
            page,
            limit,
            responseKeys: Object.keys(data),
          },
        });

        logger.error(
          { error: parseResult.error.errors, guildId: effectiveGuildId, page },
          'MEE6 API response validation failed'
        );

        throw new Error('MEE6 API response validation failed');
      }

      return parseResult.data;
    },
    {
      retries: 3,
      minTimeout: 5000, // 5 seconds base
      maxTimeout: 60000, // 1 minute max
      onFailedAttempt: (error) => {
        logger.warn(
          {
            guildId: effectiveGuildId,
            page,
            attempt: error.attemptNumber,
            retriesLeft: error.retriesLeft,
            error: error.message,
          },
          'MEE6 API retry'
        );
      },
    }
  );
}

/**
 * Fetch XP data for specific Discord users
 *
 * Fetches leaderboard pages until all requested users are found or pages exhausted.
 * Uses limit=500 per page and 2-second delays between fetches for rate limit safety.
 *
 * @param discordIds - Array of Discord user IDs to find
 * @param guildId - Discord guild ID (defaults to DISCORD_GUILD_ID from env)
 * @returns Map of discordId -> { xp, level, messageCount } for found members
 *          Members not found in MEE6 leaderboard are omitted from the map
 */
export async function fetchAllMemberXp(
  discordIds: string[],
  guildId?: string
): Promise<MemberXpMap> {
  const effectiveGuildId = guildId ?? env.DISCORD_GUILD_ID;
  const result: MemberXpMap = new Map();

  // Convert to Set for O(1) lookup
  const targetIds = new Set(discordIds);
  const foundIds = new Set<string>();

  // Track how many we're looking for
  const totalToFind = targetIds.size;

  let page = 0;
  const limit = 500; // Per RESEARCH.md recommendation

  logger.debug(
    { guildId: effectiveGuildId, memberCount: totalToFind },
    'Starting MEE6 XP fetch'
  );

  try {
    while (foundIds.size < totalToFind) {
      // Add delay between page fetches (skip on first page)
      if (page > 0) {
        await sleep(PAGE_FETCH_DELAY_MS);
      }

      const response = await fetchLeaderboardPage(effectiveGuildId, page, limit);

      // No more players - we've exhausted the leaderboard
      if (response.players.length === 0) {
        logger.debug(
          { page, found: foundIds.size, total: totalToFind },
          'MEE6 leaderboard exhausted'
        );
        break;
      }

      // Process players on this page
      for (const player of response.players) {
        if (targetIds.has(player.id) && !foundIds.has(player.id)) {
          result.set(player.id, {
            xp: player.xp,
            level: player.level,
            messageCount: player.message_count,
          });
          foundIds.add(player.id);
        }
      }

      logger.debug(
        { page, playersOnPage: response.players.length, found: foundIds.size, total: totalToFind },
        'Processed MEE6 leaderboard page'
      );

      // If we got fewer players than limit, we've reached the end
      if (response.players.length < limit) {
        break;
      }

      page++;
    }
  } catch (error) {
    // AbortError (401) or exhausted retries
    if (error instanceof AbortError) {
      logger.error({ guildId: effectiveGuildId, error: error.message }, 'MEE6 fetch aborted');
      throw error;
    }

    logger.error(
      { guildId: effectiveGuildId, page, error: error instanceof Error ? error.message : error },
      'MEE6 fetch failed'
    );
    throw error;
  }

  logger.info(
    { guildId: effectiveGuildId, found: result.size, requested: totalToFind },
    'MEE6 XP fetch complete'
  );

  return result;
}
