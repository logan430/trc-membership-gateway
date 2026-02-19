import { SignJWT, jwtVerify } from 'jose';
import { randomUUID } from 'crypto';
import { env } from '../config/env.js';

// JWT secret as Uint8Array for jose (same as session.ts)
const secret = new TextEncoder().encode(env.JWT_SECRET);

// Track used magic link token IDs to enforce single-use
// In-memory is acceptable since tokens only last 5 minutes
const usedTokenIds = new Map<string, number>(); // jti -> expiry timestamp

// Clean up expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [jti, expiry] of usedTokenIds) {
    if (expiry < now) usedTokenIds.delete(jti);
  }
}, 10 * 60 * 1000);

// Magic link token payload
interface MagicLinkPayload {
  email: string;
  purpose: 'magic-link';
}

/**
 * Create a magic link token (5 minute expiry)
 * Short-lived for security - user should click immediately
 * Includes unique jti for single-use enforcement
 */
export async function createMagicLinkToken(email: string): Promise<string> {
  return new SignJWT({ email, purpose: 'magic-link' as const })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secret);
}

/**
 * Verify a magic link token (single-use)
 * Returns email on success, null on any error (expired, invalid, wrong purpose, already used)
 */
export async function verifyMagicLink(
  token: string
): Promise<{ email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret);

    // Validate purpose to prevent token misuse
    if (payload.purpose !== 'magic-link') {
      return null;
    }

    // Enforce single-use via jti
    const jti = payload.jti;
    if (!jti || usedTokenIds.has(jti)) {
      return null;
    }

    // Mark as used (store with expiry for cleanup)
    const expiry = typeof payload.exp === 'number' ? payload.exp * 1000 : Date.now() + 5 * 60 * 1000;
    usedTokenIds.set(jti, expiry);

    return { email: payload.email as string };
  } catch {
    // Token is expired, invalid, or malformed
    return null;
  }
}

/**
 * Build the full magic link URL for the user to click
 */
export function buildMagicLinkUrl(token: string): string {
  return `${env.APP_URL}/auth/magic-link/verify?token=${token}`;
}
