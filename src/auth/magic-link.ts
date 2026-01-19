import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env.js';

// JWT secret as Uint8Array for jose (same as session.ts)
const secret = new TextEncoder().encode(env.JWT_SECRET);

// Magic link token payload
interface MagicLinkPayload {
  email: string;
  purpose: 'magic-link';
}

/**
 * Create a magic link token (5 minute expiry)
 * Short-lived for security - user should click immediately
 */
export async function createMagicLinkToken(email: string): Promise<string> {
  return new SignJWT({ email, purpose: 'magic-link' as const })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secret);
}

/**
 * Verify a magic link token
 * Returns email on success, null on any error (expired, invalid, wrong purpose)
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
