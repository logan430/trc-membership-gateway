import { randomBytes, timingSafeEqual } from 'crypto';

/**
 * Generate a cryptographically secure, URL-safe invite token
 * Uses 32 bytes (256 bits) of entropy, encoded as base64url
 * Results in 43-character token
 */
export function generateInviteToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Timing-safe comparison of invite tokens
 * Prevents timing attacks that could leak token information
 */
export function validateToken(provided: string, stored: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(stored, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
