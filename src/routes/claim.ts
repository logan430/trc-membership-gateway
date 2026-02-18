import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { parse as parseCookie, serialize as serializeCookie } from 'cookie';
import { requireAuth, AuthenticatedRequest } from '../middleware/session.js';
import { generateAuthUrl, exchangeCode, fetchDiscordUser } from '../auth/discord-oauth.js';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { logger } from '../index.js';
import { assignRoleAsync } from '../lib/role-assignment.js';
import { ROLE_CONFIG } from '../config/discord.js';

export const claimRouter = Router();

// OAuth state cookie config (same as auth routes)
const CLAIM_STATE_COOKIE = 'claim_state';
const CLAIM_STATE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 10 * 60, // 10 minutes
  path: '/',
};

// Store member ID with state for callback
const CLAIM_MEMBER_COOKIE = 'claim_member';

/**
 * GET /claim/discord
 * Initiate Discord OAuth for claim flow (requires auth + active subscription)
 */
claimRouter.get('/discord', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const member = await prisma.member.findUnique({
    where: { id: req.memberId },
  });

  // Verify subscription is active
  if (!member || member.subscriptionStatus !== 'ACTIVE') {
    res.status(403).json({ error: 'Active subscription required to claim Discord access' });
    return;
  }

  // Verify not already claimed
  if (member.discordId) {
    res.status(400).json({ error: 'Discord already linked', discordInviteUrl: env.DISCORD_INVITE_URL });
    return;
  }

  // Generate state for CSRF protection
  const state = randomUUID();

  // Set cookies: state and member ID
  res.setHeader('Set-Cookie', [
    serializeCookie(CLAIM_STATE_COOKIE, state, CLAIM_STATE_OPTIONS),
    serializeCookie(CLAIM_MEMBER_COOKIE, req.memberId!, { ...CLAIM_STATE_OPTIONS, httpOnly: true }),
  ]);

  // Redirect to Discord OAuth
  const authUrl = generateAuthUrl(state);
  res.redirect(authUrl);
});

/**
 * GET /claim/callback
 * Handle Discord OAuth callback for claim flow
 */
claimRouter.get('/callback', async (req: Request, res: Response): Promise<void> => {
  const { code, state } = req.query;

  // Parse cookies
  const cookieHeader = req.headers.cookie ?? '';
  const cookies = parseCookie(cookieHeader);
  const storedState = cookies[CLAIM_STATE_COOKIE];
  const memberId = cookies[CLAIM_MEMBER_COOKIE];

  // Clear claim cookies
  res.setHeader('Set-Cookie', [
    serializeCookie(CLAIM_STATE_COOKIE, '', { ...CLAIM_STATE_OPTIONS, maxAge: 0 }),
    serializeCookie(CLAIM_MEMBER_COOKIE, '', { ...CLAIM_STATE_OPTIONS, maxAge: 0 }),
  ]);

  // Validate state (CSRF protection)
  if (!state || state !== storedState) {
    res.redirect('/dashboard?claim=error&reason=invalid_state');
    return;
  }

  // Validate member ID from cookie
  if (!memberId) {
    res.redirect('/dashboard?claim=error&reason=session_expired');
    return;
  }

  // Validate code
  if (!code || typeof code !== 'string') {
    res.redirect('/dashboard?claim=error&reason=no_code');
    return;
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCode(code);

    // Fetch Discord user info
    const discordUser = await fetchDiscordUser(tokens.access_token);

    // Check if Discord ID already linked to ANOTHER member
    const existingMember = await prisma.member.findFirst({
      where: {
        discordId: discordUser.id,
        id: { not: memberId },
      },
    });

    if (existingMember) {
      logger.warn(
        { memberId, discordId: discordUser.id, existingMemberId: existingMember.id },
        'Discord already linked to another account'
      );
      res.redirect('/dashboard?claim=error&reason=discord_already_linked');
      return;
    }

    // Link Discord to member
    await prisma.member.update({
      where: { id: memberId },
      data: {
        discordId: discordUser.id,
        discordUsername: discordUser.global_name ?? discordUser.username,
        discordAvatar: discordUser.avatar,
      },
    });

    // Assign Squire role asynchronously (fire-and-forget)
    assignRoleAsync(discordUser.id, ROLE_CONFIG.SQUIRE.name);

    logger.info(
      { memberId, discordId: discordUser.id, discordUsername: discordUser.username },
      'Discord claim successful, redirecting to invite'
    );

    // Redirect to claim success page
    res.redirect('/dashboard/claim-success');
  } catch (error) {
    logger.error({ error, memberId }, 'Discord claim callback failed');
    res.redirect('/dashboard?claim=error&reason=oauth_failed');
  }
});
