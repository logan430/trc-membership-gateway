import { Request, Response, NextFunction } from 'express';
import { parse as parseCookie } from 'cookie';
import { verifyToken, REFRESH_COOKIE_NAME } from '../auth/session.js';

/**
 * Extended Request type with authenticated member ID
 */
export interface AuthenticatedRequest extends Request {
  memberId?: string;
}

/**
 * Middleware to require authentication via Bearer token or refresh cookie.
 *
 * API calls send access tokens as Authorization: Bearer headers.
 * Full-page navigations (like /claim/discord) only send cookies,
 * so we fall back to the refresh token cookie when no header is present.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  // Primary: Authorization header with Bearer scheme (API calls)
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = await verifyToken(token);

    if (!payload) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // Reject refresh tokens sent as Bearer (must use access tokens for API)
    if (payload.type === 'refresh') {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    req.memberId = payload.sub;
    next();
    return;
  }

  // Fallback: refresh token cookie (full-page navigations)
  const cookies = parseCookie(req.headers.cookie ?? '');
  const refreshToken = cookies[REFRESH_COOKIE_NAME];

  if (refreshToken) {
    const payload = await verifyToken(refreshToken);

    if (payload && payload.type === 'refresh') {
      req.memberId = payload.sub;
      next();
      return;
    }
  }

  res.status(401).json({ error: 'Missing authorization header' });
}
