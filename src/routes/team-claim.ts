import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { parse as parseCookie, serialize as serializeCookie } from 'cookie';
import { generateAuthUrl, exchangeCode, fetchDiscordUser } from '../auth/discord-oauth.js';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { logger } from '../index.js';
import { assignRoleAsync } from '../lib/role-assignment.js';
import { ROLE_CONFIG } from '../config/discord.js';

export const teamClaimRouter = Router();

// Cookie configuration for team claim flow
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 10 * 60, // 10 minutes
  path: '/',
};

/**
 * GET /team/claim/info
 * Fetch invite details for landing page display
 */
teamClaimRouter.get('/claim/info', async (req: Request, res: Response): Promise<void> => {
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'Missing token' });
    return;
  }

  const invite = await prisma.pendingInvite.findUnique({
    where: { token },
    include: { team: true },
  });

  if (!invite) {
    res.status(404).json({ error: 'Invalid invite' });
    return;
  }

  // Check seat availability
  const claimedCount = await prisma.member.count({
    where: { teamId: invite.teamId, seatTier: invite.seatTier },
  });
  const maxSeats = invite.seatTier === 'OWNER'
    ? invite.team.ownerSeatCount
    : invite.team.teamSeatCount;

  res.json({
    teamName: invite.team.name,
    seatTier: invite.seatTier,
    seatsAvailable: maxSeats - claimedCount > 0,
  });
});

/**
 * GET /team/claim
 * Initiate team claim flow - validate token and redirect to Discord OAuth
 */
teamClaimRouter.get('/claim', async (req: Request, res: Response): Promise<void> => {
  const { token } = req.query;

  // Validate token parameter
  if (!token || typeof token !== 'string') {
    res.redirect('/?error=missing_token');
    return;
  }

  // Validate invite token
  const invite = await prisma.pendingInvite.findUnique({
    where: { token },
    include: {
      team: {
        include: {
          members: true,
        },
      },
    },
  });

  if (!invite) {
    res.redirect('/?error=invalid_token');
    return;
  }

  // Check seat availability (preliminary check - transaction will verify atomically)
  const claimedSeats = invite.team.members.filter(m => m.seatTier === invite.seatTier).length;
  const maxSeats = invite.seatTier === 'OWNER'
    ? invite.team.ownerSeatCount
    : invite.team.teamSeatCount;

  if (claimedSeats >= maxSeats) {
    res.redirect('/?error=no_seats_available');
    return;
  }

  // Store token in cookie for callback, generate OAuth state
  const state = randomUUID();

  res.setHeader('Set-Cookie', [
    serializeCookie('team_claim_state', state, COOKIE_OPTIONS),
    serializeCookie('team_claim_token', token, COOKIE_OPTIONS),
  ]);

  // Redirect to Discord OAuth
  const authUrl = generateAuthUrl(state);
  res.redirect(authUrl);
});

/**
 * GET /team/claim/callback
 * Handle Discord OAuth callback for team claim flow
 */
teamClaimRouter.get('/claim/callback', async (req: Request, res: Response): Promise<void> => {
  const { code, state } = req.query;

  // Parse cookies
  const cookieHeader = req.headers.cookie ?? '';
  const cookies = parseCookie(cookieHeader);
  const storedState = cookies['team_claim_state'];
  const token = cookies['team_claim_token'];

  // Clear claim cookies immediately
  res.setHeader('Set-Cookie', [
    serializeCookie('team_claim_state', '', { ...COOKIE_OPTIONS, maxAge: 0 }),
    serializeCookie('team_claim_token', '', { ...COOKIE_OPTIONS, maxAge: 0 }),
  ]);

  // Validate OAuth state (CSRF protection)
  if (!state || state !== storedState) {
    res.redirect('/?error=invalid_state');
    return;
  }

  // Validate token from cookie
  if (!token) {
    res.redirect('/?error=session_expired');
    return;
  }

  // Validate OAuth code
  if (!code || typeof code !== 'string') {
    res.redirect('/?error=no_code');
    return;
  }

  try {
    // Exchange code for Discord tokens
    const tokens = await exchangeCode(code);

    // Fetch Discord user info
    const discordUser = await fetchDiscordUser(tokens.access_token);

    // Re-fetch invite (it must still exist)
    const invite = await prisma.pendingInvite.findUnique({
      where: { token },
      include: { team: true },
    });

    if (!invite) {
      res.redirect('/?error=invalid_token');
      return;
    }

    // Check for existing individual subscription (block with clear message)
    const existingMember = await prisma.member.findUnique({
      where: { discordId: discordUser.id },
    });

    if (existingMember?.subscriptionStatus === 'ACTIVE' && !existingMember.teamId) {
      // Individual subscriber trying to claim team seat
      logger.warn(
        { discordId: discordUser.id, existingMemberId: existingMember.id },
        'Individual subscriber attempted to claim team seat'
      );
      res.redirect('/?error=already_subscribed&message=You already have owner access through your individual subscription');
      return;
    }

    // Check if Discord ID already linked to another team
    if (existingMember?.teamId && existingMember.teamId !== invite.teamId) {
      logger.warn(
        { discordId: discordUser.id, currentTeamId: existingMember.teamId, inviteTeamId: invite.teamId },
        'User already in different team attempted to claim seat'
      );
      res.redirect('/?error=already_in_team');
      return;
    }

    // Atomic seat claim with transaction (prevents race condition)
    const result = await prisma.$transaction(async (tx) => {
      // Re-fetch team with member count to prevent race condition
      const teamMembers = await tx.member.findMany({
        where: { teamId: invite.teamId, seatTier: invite.seatTier },
      });

      const team = await tx.team.findUnique({
        where: { id: invite.teamId },
      });

      if (!team) {
        throw new Error('TEAM_NOT_FOUND');
      }

      const maxSeats = invite.seatTier === 'OWNER'
        ? team.ownerSeatCount
        : team.teamSeatCount;

      if (teamMembers.length >= maxSeats) {
        throw new Error('NO_SEATS_AVAILABLE');
      }

      // Create or update member
      const member = await tx.member.upsert({
        where: { discordId: discordUser.id },
        create: {
          discordId: discordUser.id,
          discordUsername: discordUser.global_name ?? discordUser.username,
          discordAvatar: discordUser.avatar,
          teamId: invite.teamId,
          seatTier: invite.seatTier,
          subscriptionStatus: 'ACTIVE',
        },
        update: {
          discordUsername: discordUser.global_name ?? discordUser.username,
          discordAvatar: discordUser.avatar,
          teamId: invite.teamId,
          seatTier: invite.seatTier,
          subscriptionStatus: 'ACTIVE',
        },
      });

      // Mark invite as used (but keep for tracking)
      await tx.pendingInvite.update({
        where: { id: invite.id },
        data: {
          acceptedAt: new Date(),
          acceptedBy: member.id,
        },
      });

      return member;
    });

    // Assign Squire role (fire-and-forget with retry)
    assignRoleAsync(discordUser.id, ROLE_CONFIG.SQUIRE.name);

    logger.info(
      { memberId: result.id, teamId: invite.teamId, seatTier: invite.seatTier, discordId: discordUser.id },
      'Team seat claimed successfully'
    );

    // Redirect to Discord server invite
    res.redirect(env.DISCORD_INVITE_URL ?? '/');
  } catch (error) {
    if (error instanceof Error && error.message === 'NO_SEATS_AVAILABLE') {
      logger.warn({ token }, 'Seat claim failed: no seats available (race condition caught)');
      res.redirect('/?error=no_seats_available');
      return;
    }

    if (error instanceof Error && error.message === 'TEAM_NOT_FOUND') {
      logger.error({ token }, 'Team not found during claim');
      res.redirect('/?error=team_not_found');
      return;
    }

    logger.error({ error, token }, 'Team claim failed');
    res.redirect('/?error=claim_failed');
  }
});
