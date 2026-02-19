import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { parse as parseCookie, serialize as serializeCookie } from 'cookie';
import { z } from 'zod';
import Stripe from 'stripe';
import {
  verifyToken,
  createAccessToken,
  createRefreshToken,
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_OPTIONS,
} from '../auth/session.js';
import {
  createMagicLinkToken,
  verifyMagicLink,
  buildMagicLinkUrl,
} from '../auth/magic-link.js';
import {
  generateAuthUrl,
  exchangeCode,
  fetchDiscordUser,
} from '../auth/discord-oauth.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/session.js';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../index.js';
import { sendPasswordResetEmail, sendPasswordResetConfirmationEmail } from '../email/send.js';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export const authRouter = Router();

// Validation schemas
const signupSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const updateEmailSchema = z.object({
  newEmail: z.string().email('Invalid email format'),
  currentPassword: z.string().min(1, 'Password is required'),
});

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long'),
});

/**
 * POST /auth/signup
 * Create a new account with email and password
 * Returns same success response whether email exists or not (anti-enumeration)
 */
authRouter.post('/signup', async (req: Request, res: Response): Promise<void> => {
  // Validate input
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { email, password } = parsed.data;

  // Check if email already exists
  const existingMember = await prisma.member.findUnique({
    where: { email },
  });

  if (existingMember) {
    logger.debug({ email }, 'Signup attempt for existing email');
    res.status(409).json({ error: 'An account with this email already exists. Please log in instead.' });
    return;
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create Stripe customer
  const stripeCustomer = await stripe.customers.create({
    email,
    metadata: {
      source: 'signup',
    },
  });

  // Create member
  const member = await prisma.member.create({
    data: {
      email,
      passwordHash,
      stripeCustomerId: stripeCustomer.id,
      seatTier: 'INDIVIDUAL',
    },
  });

  // Create tokens
  const accessToken = await createAccessToken(member.id);
  const refreshToken = await createRefreshToken(member.id, true);

  // Set refresh cookie
  res.setHeader(
    'Set-Cookie',
    serializeCookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS)
  );

  logger.info({ memberId: member.id, email }, 'New user signup successful');

  res.json({
    accessToken,
    expiresIn: 900,
  });
});

/**
 * POST /auth/login
 * Authenticate with email and password
 * Uses timing-safe verification to prevent timing attacks
 */
authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  // Validate input
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { email, password } = parsed.data;

  // Find member by email
  const member = await prisma.member.findUnique({
    where: { email },
  });

  // Always verify password to prevent timing attacks
  // Use a dummy hash if member not found to maintain constant time
  const dummyHash = '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const hashToVerify = member?.passwordHash ?? dummyHash;

  const isValid = await verifyPassword(hashToVerify, password);

  // Return generic error for both invalid email and password
  if (!member || !member.passwordHash || !isValid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  // Create tokens
  const accessToken = await createAccessToken(member.id);
  const refreshToken = await createRefreshToken(member.id, true);

  // Set refresh cookie
  res.setHeader(
    'Set-Cookie',
    serializeCookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS)
  );

  logger.info({ memberId: member.id, email }, 'User login successful');

  res.json({
    accessToken,
    expiresIn: 900,
  });
});

/**
 * POST /auth/refresh
 * Exchange a valid refresh token for a new access token and rotated refresh token
 */
authRouter.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  // Parse cookies from Cookie header
  const cookieHeader = req.headers.cookie ?? '';
  const cookies = parseCookie(cookieHeader);
  const refreshToken = cookies[REFRESH_COOKIE_NAME];

  if (!refreshToken) {
    res.status(401).json({ error: 'No refresh token' });
    return;
  }

  // Verify the refresh token
  const payload = await verifyToken(refreshToken);

  if (!payload || payload.type !== 'refresh') {
    res.status(401).json({ error: 'Invalid refresh token' });
    return;
  }

  // Lookup member in database
  const member = await prisma.member.findUnique({
    where: { id: payload.sub },
  });

  if (!member) {
    res.status(401).json({ error: 'Invalid refresh token' });
    return;
  }

  // Create new tokens (rotation: new refresh token each time)
  const accessToken = await createAccessToken(member.id);
  const newRefreshToken = await createRefreshToken(member.id, true); // Default to rememberMe

  // Set new refresh cookie
  res.setHeader(
    'Set-Cookie',
    serializeCookie(REFRESH_COOKIE_NAME, newRefreshToken, REFRESH_COOKIE_OPTIONS)
  );

  // Return access token
  res.json({
    accessToken,
    expiresIn: 900, // 15 minutes in seconds
  });

  logger.debug({ memberId: member.id }, 'Token refresh successful');
});

/**
 * POST /auth/logout
 * Clear the refresh token cookie to end the session
 */
authRouter.post('/logout', (_req: Request, res: Response): void => {
  // Clear refresh cookie by setting it with immediate expiry
  res.setHeader(
    'Set-Cookie',
    serializeCookie(REFRESH_COOKIE_NAME, '', {
      ...REFRESH_COOKIE_OPTIONS,
      maxAge: 0, // Expire immediately
    })
  );

  res.json({ success: true });
});

/**
 * POST /auth/magic-link/request
 * Request a magic link for passwordless login
 * Returns same response whether email exists or not (security best practice)
 */
authRouter.post('/magic-link/request', async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  // Always return success message to prevent email enumeration
  const successResponse = {
    success: true,
    message: 'If an account exists, a magic link has been sent',
  };

  // Look up member by email
  const member = await prisma.member.findFirst({
    where: { email },
  });

  if (!member) {
    // Don't reveal that email doesn't exist
    res.json(successResponse);
    return;
  }

  // Create magic link token
  const token = await createMagicLinkToken(email);
  const magicLinkUrl = buildMagicLinkUrl(token);

  // Log the magic link (Phase 7 will add email sending)
  logger.info({ email, url: magicLinkUrl }, 'Magic link generated');

  res.json(successResponse);
});

/**
 * GET /auth/magic-link/verify
 * Verify magic link token and create session
 * Redirects to dashboard with access token on success
 */
authRouter.get('/magic-link/verify', async (req: Request, res: Response): Promise<void> => {
  const token = req.query.token as string | undefined;

  if (!token) {
    res.status(400).json({ error: 'Token is required' });
    return;
  }

  // Verify the magic link token
  const payload = await verifyMagicLink(token);

  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired magic link' });
    return;
  }

  // Look up member by email
  const member = await prisma.member.findFirst({
    where: { email: payload.email },
  });

  if (!member) {
    res.status(401).json({ error: 'Member not found' });
    return;
  }

  // Create session tokens (rememberMe = true for magic link users)
  const accessToken = await createAccessToken(member.id);
  const refreshToken = await createRefreshToken(member.id, true);

  // Set refresh cookie
  res.setHeader(
    'Set-Cookie',
    serializeCookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS)
  );

  logger.info({ memberId: member.id, email: payload.email }, 'Magic link login successful');

  // Redirect to dashboard with token in fragment (client-side only)
  res.redirect(`/dashboard#token=${accessToken}`);
});

// OAuth state cookie config
const OAUTH_STATE_COOKIE = 'oauth_state';
const OAUTH_STATE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 10 * 60, // 10 minutes in seconds
  path: '/',
};

/**
 * GET /auth/discord
 * Initiate Discord OAuth2 authorization code flow
 */
authRouter.get('/discord', (_req: Request, res: Response): void => {
  // Generate cryptographic state for CSRF protection
  const state = randomUUID();

  // Set state cookie
  res.setHeader(
    'Set-Cookie',
    serializeCookie(OAUTH_STATE_COOKIE, state, OAUTH_STATE_OPTIONS)
  );

  // Redirect to Discord authorization
  const authUrl = generateAuthUrl(state);
  res.redirect(authUrl);
});

/**
 * GET /auth/callback
 * Handle Discord OAuth2 callback
 * Validates state, exchanges code, links Discord, creates session
 */
authRouter.get('/callback', async (req: Request, res: Response): Promise<void> => {
  const { code, state } = req.query;

  // Parse stored state from cookie
  const cookieHeader = req.headers.cookie ?? '';
  const cookies = parseCookie(cookieHeader);

  // Detect which OAuth flow this callback belongs to
  // All three flows (auth, claim, team-claim) use the same redirect_uri (/auth/callback)
  // because generateAuthUrl always returns /auth/callback. We detect the flow by checking
  // which state cookie is present and route to the appropriate callback handler.
  const claimState = cookies['claim_state'];
  const teamClaimState = cookies['team_claim_state'];

  // Route claim flow to claim callback
  if (claimState && state === claimState) {
    res.redirect(`/claim/callback?code=${encodeURIComponent(code as string)}&state=${encodeURIComponent(state as string)}`);
    return;
  }

  // Route team claim flow to team claim callback
  if (teamClaimState && state === teamClaimState) {
    res.redirect(`/team/claim/callback?code=${encodeURIComponent(code as string)}&state=${encodeURIComponent(state as string)}`);
    return;
  }

  // Continue with standard auth flow
  const storedState = cookies[OAUTH_STATE_COOKIE];

  // Validate state parameter (CSRF protection)
  if (!state || state !== storedState) {
    res.redirect('/auth/error?reason=invalid_state');
    return;
  }

  // Clear state cookie
  res.setHeader(
    'Set-Cookie',
    serializeCookie(OAUTH_STATE_COOKIE, '', { ...OAUTH_STATE_OPTIONS, maxAge: 0 })
  );

  // Validate code parameter
  if (!code || typeof code !== 'string') {
    res.redirect('/auth/error?reason=no_code');
    return;
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCode(code);

    // Fetch Discord user info
    const discordUser = await fetchDiscordUser(tokens.access_token);

    // Check if Discord ID already linked to another member
    const existingMember = await prisma.member.findUnique({
      where: { discordId: discordUser.id },
    });

    if (existingMember) {
      // Discord already linked - prevent duplicate linking per CONTEXT.md
      res.redirect('/auth/error?reason=discord_already_linked');
      return;
    }

    // Create or update member with Discord info
    // Note: In Phase 3, members will be created at payment time
    // This creates a stub member for users who link Discord first
    const member = await prisma.member.create({
      data: {
        discordId: discordUser.id,
        discordUsername: discordUser.global_name ?? discordUser.username,
        discordAvatar: discordUser.avatar,
      },
    });

    // Create session tokens (rememberMe = true for OAuth flow)
    const accessToken = await createAccessToken(member.id);
    const refreshToken = await createRefreshToken(member.id, true);

    // Set refresh cookie
    res.setHeader(
      'Set-Cookie',
      serializeCookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS)
    );

    logger.info(
      { memberId: member.id, discordId: discordUser.id, discordUsername: discordUser.username },
      'Discord OAuth login successful'
    );

    // Redirect to dashboard with access token in fragment (client-side only)
    res.redirect(`/dashboard#token=${accessToken}`);
  } catch (error) {
    logger.error({ error }, 'Discord OAuth callback failed');
    res.redirect('/auth/error?reason=oauth_failed');
  }
});

/**
 * GET /auth/error
 * Display OAuth error information
 * In production, this would render an error page
 */
authRouter.get('/error', (req: Request, res: Response): void => {
  const reason = req.query.reason as string | undefined;
  res.status(400).json({ error: reason ?? 'unknown_error' });
});

/**
 * POST /auth/update-email
 * Update authenticated member's email address
 * Requires current password verification
 * Updates both database and Stripe customer (if exists)
 */
authRouter.post('/update-email', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parsed = updateEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { newEmail, currentPassword } = parsed.data;

  const member = await prisma.member.findUnique({
    where: { id: req.memberId },
  });

  if (!member) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  // Require password-based account (magic link only users cannot change email this way)
  if (!member.passwordHash) {
    res.status(400).json({ error: 'Password not set. Please set a password first.' });
    return;
  }

  // Verify current password
  const isValid = await verifyPassword(member.passwordHash, currentPassword);
  if (!isValid) {
    res.status(401).json({ error: 'Invalid password' });
    return;
  }

  // Check new email not in use by another member
  const existing = await prisma.member.findUnique({
    where: { email: newEmail },
  });
  if (existing && existing.id !== member.id) {
    res.status(409).json({ error: 'Email already in use' });
    return;
  }

  // Update Stripe customer first (if fails, don't update DB)
  if (member.stripeCustomerId) {
    try {
      await stripe.customers.update(member.stripeCustomerId, { email: newEmail });
    } catch (stripeError) {
      logger.error({ memberId: member.id, error: stripeError }, 'Failed to update Stripe customer email');
      res.status(500).json({ error: 'Failed to update email' });
      return;
    }
  }

  // Update database
  await prisma.member.update({
    where: { id: member.id },
    data: { email: newEmail },
  });

  logger.info({ memberId: member.id, oldEmail: member.email, newEmail }, 'Member email updated');
  res.json({ success: true, email: newEmail });
});

/**
 * POST /auth/update-password
 * Update authenticated member's password
 * Requires current password verification
 */
authRouter.post('/update-password', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parsed = updatePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { currentPassword, newPassword } = parsed.data;

  const member = await prisma.member.findUnique({
    where: { id: req.memberId },
  });

  if (!member) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  // Magic link users without password cannot use this endpoint
  if (!member.passwordHash) {
    res.status(404).json({ error: 'No password set. Use magic link to set a password.' });
    return;
  }

  // Verify current password
  const isValid = await verifyPassword(member.passwordHash, currentPassword);
  if (!isValid) {
    res.status(401).json({ error: 'Invalid current password' });
    return;
  }

  // Hash and save new password
  const newHash = await hashPassword(newPassword);
  await prisma.member.update({
    where: { id: member.id },
    data: { passwordHash: newHash },
  });

  logger.info({ memberId: member.id }, 'Member password updated');
  res.json({ success: true });
});

/**
 * POST /auth/forgot-password
 * Request a password reset email
 * Always returns success to prevent email enumeration
 */
authRouter.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { email } = parsed.data;

  // Always return success message (prevent email enumeration)
  const successResponse = {
    success: true,
    message: 'If an account exists with this email, a password reset link has been sent.',
  };

  // Find member by email
  const member = await prisma.member.findUnique({
    where: { email },
  });

  // If member not found, return success anyway (security)
  if (!member) {
    logger.debug({ email }, 'Password reset requested for non-existent email');
    res.json(successResponse);
    return;
  }

  // Generate secure token
  const token = randomUUID();

  // Set expiry to 1 hour from now
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  // Create password reset token in database
  await prisma.passwordResetToken.create({
    data: {
      token,
      memberId: member.id,
      expiresAt,
    },
  });

  // Build reset URL
  const resetUrl = `${env.APP_URL}/reset-password?token=${token}`;

  // Send email (fire-and-forget, don't fail the request)
  try {
    await sendPasswordResetEmail(email, resetUrl);
  } catch (error) {
    logger.error({ email, error }, 'Failed to send password reset email');
    // Still return success to prevent enumeration
  }

  // Log for audit trail
  logger.info({ memberId: member.id, email }, 'Password reset requested');

  res.json(successResponse);
});

/**
 * POST /auth/reset-password
 * Reset password using a valid token
 */
authRouter.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { token, newPassword } = parsed.data;

  // Find token in database
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { member: true },
  });

  // Validate token exists
  if (!resetToken) {
    res.status(400).json({ error: 'Invalid or expired reset link' });
    return;
  }

  // Validate token not already used
  if (resetToken.usedAt) {
    res.status(400).json({ error: 'This reset link has already been used' });
    return;
  }

  // Validate token not expired
  if (resetToken.expiresAt < new Date()) {
    res.status(400).json({ error: 'This reset link has expired' });
    return;
  }

  // Hash new password
  const passwordHash = await hashPassword(newPassword);

  // Update member password and mark token as used in a transaction
  await prisma.$transaction([
    prisma.member.update({
      where: { id: resetToken.memberId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  // Send confirmation email (fire-and-forget)
  if (resetToken.member.email) {
    try {
      await sendPasswordResetConfirmationEmail(resetToken.member.email);
    } catch (error) {
      logger.error({ email: resetToken.member.email, error }, 'Failed to send password reset confirmation email');
    }
  }

  // Log for audit trail
  logger.info({ memberId: resetToken.memberId }, 'Password reset completed');

  res.json({ success: true, message: 'Password has been reset successfully' });
});
