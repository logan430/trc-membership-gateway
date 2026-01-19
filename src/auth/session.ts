import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env.js';

// JWT secret as Uint8Array for jose
const secret = new TextEncoder().encode(env.JWT_SECRET);

// Token payload types
export interface TokenPayload {
  sub: string;
  type?: 'refresh';
}

/**
 * Create an access token (15 minute expiry)
 * Used for API authentication, sent in Authorization header
 */
export async function createAccessToken(memberId: string): Promise<string> {
  return new SignJWT({ sub: memberId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret);
}

/**
 * Create a refresh token
 * 30 days with rememberMe, 7 days without
 * Stored in httpOnly cookie for security
 */
export async function createRefreshToken(
  memberId: string,
  rememberMe: boolean
): Promise<string> {
  const expiry = rememberMe ? '30d' : '7d';
  return new SignJWT({ sub: memberId, type: 'refresh' as const })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiry)
    .sign(secret);
}

/**
 * Verify any token (access or refresh)
 * Returns payload on success, null on any error (expired, invalid, etc.)
 */
export async function verifyToken(
  token: string
): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      sub: payload.sub as string,
      type: payload.type as 'refresh' | undefined,
    };
  } catch {
    // Token is expired, invalid, or malformed
    return null;
  }
}

// Cookie configuration for refresh token
export const REFRESH_COOKIE_NAME = 'trc_refresh';

export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/auth/refresh',
  maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
};
