import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../auth/session.js';

/**
 * Extended Request type with authenticated member ID
 */
export interface AuthenticatedRequest extends Request {
  memberId?: string;
}

/**
 * Middleware to require authentication via Bearer token
 * Extracts and verifies JWT from Authorization header
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  // Check for Authorization header with Bearer scheme
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization header' });
    return;
  }

  // Extract token (everything after "Bearer ")
  const token = authHeader.slice(7);

  // Verify token
  const payload = await verifyToken(token);

  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  // Reject refresh tokens used as access tokens
  if (payload.type === 'refresh') {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  // Attach member ID to request for downstream handlers
  req.memberId = payload.sub;
  next();
}
