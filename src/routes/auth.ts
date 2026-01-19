import { Router, Request, Response } from 'express';
import { parse as parseCookie, serialize as serializeCookie } from 'cookie';
import {
  verifyToken,
  createAccessToken,
  createRefreshToken,
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_OPTIONS,
} from '../auth/session.js';
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
