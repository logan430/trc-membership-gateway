import { Router, Request, Response } from 'express';
import { parse as parseCookie, serialize as serializeCookie } from 'cookie';
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
import { prisma } from '../lib/prisma.js';
import { logger } from '../index.js';

export const authRouter = Router();

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
