import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env.js';
import type { AdminRole } from '@prisma/client';

// JWT secret as Uint8Array for jose (reuse same secret as member tokens)
const secret = new TextEncoder().encode(env.JWT_SECRET);

/**
 * Admin token payload - includes isAdmin flag to distinguish from member tokens
 */
export interface AdminTokenPayload {
  sub: string;
  type?: 'refresh';
  isAdmin: true;
  role: 'ADMIN' | 'SUPER_ADMIN';
}

/**
 * Create an admin access token (15 minute expiry)
 * Used for API authentication, sent in Authorization header
 */
export async function createAdminAccessToken(
  adminId: string,
  role: AdminRole
): Promise<string> {
  return new SignJWT({ sub: adminId, isAdmin: true, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret);
}

/**
 * Create an admin refresh token (30 days expiry per CONTEXT.md)
 * Stored in httpOnly cookie for security
 */
export async function createAdminRefreshToken(
  adminId: string,
  role: AdminRole
): Promise<string> {
  return new SignJWT({ sub: adminId, type: 'refresh' as const, isAdmin: true, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret);
}

/**
 * Verify an admin token (access or refresh)
 * Returns payload on success, null if invalid, expired, or not an admin token
 */
export async function verifyAdminToken(
  token: string
): Promise<AdminTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);

    // Verify this is an admin token
    if (payload.isAdmin !== true) {
      return null;
    }

    return {
      sub: payload.sub as string,
      type: payload.type as 'refresh' | undefined,
      isAdmin: true,
      role: payload.role as 'ADMIN' | 'SUPER_ADMIN',
    };
  } catch {
    // Token is expired, invalid, or malformed
    return null;
  }
}

// Cookie configuration for admin refresh token
// Uses separate path from member refresh token to avoid conflicts
export const ADMIN_REFRESH_COOKIE_NAME = 'trc_admin_refresh';

export const ADMIN_REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/admin/auth/refresh', // Separate from member path /auth/refresh
  maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
};
