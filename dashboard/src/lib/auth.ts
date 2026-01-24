import { jwtVerify, type JWTPayload } from 'jose';

/**
 * JWT verification for Next.js middleware
 * Uses same jose library and secret as Express backend
 *
 * @see src/auth/session.ts in Express app for token creation
 */

// JWT secret from environment - MUST match Express JWT_SECRET
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

// Token payload shape (matches Express TokenPayload)
export interface TokenPayload {
  sub: string;          // Member ID
  type?: 'refresh';     // Token type (refresh tokens have this)
  iat?: number;         // Issued at
  exp?: number;         // Expiration
}

/**
 * Verify a JWT token
 * Returns payload on success, null on any error (expired, invalid, malformed)
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  // Validate JWT_SECRET is configured
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET environment variable not set');
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);

    return {
      sub: payload.sub as string,
      type: payload.type as 'refresh' | undefined,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch (error) {
    // Token is expired, invalid, or malformed
    // Don't log in production (expected for invalid tokens)
    if (process.env.NODE_ENV === 'development') {
      console.debug('Token verification failed:', error);
    }
    return null;
  }
}

/**
 * Extract member ID from a valid refresh token
 * Returns member ID string or null if invalid
 */
export async function getMemberIdFromToken(token: string): Promise<string | null> {
  const payload = await verifyToken(token);

  // Must be a refresh token (has type: 'refresh')
  if (!payload || payload.type !== 'refresh') {
    return null;
  }

  return payload.sub;
}

// Cookie name (matches Express REFRESH_COOKIE_NAME)
export const REFRESH_COOKIE_NAME = 'trc_refresh';
