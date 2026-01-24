import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken, REFRESH_COOKIE_NAME } from './lib/auth';

/**
 * Next.js Middleware - Authentication Guard
 *
 * Protects all /dashboard/* routes by validating the refresh token cookie.
 * Invalid or missing tokens redirect to Express login page.
 *
 * How it works:
 * 1. User logs in via Express at /login
 * 2. Express sets httpOnly refresh token cookie (path: '/')
 * 3. User navigates to /dashboard/* (proxied to Next.js)
 * 4. This middleware reads cookie, validates JWT
 * 5. Valid: continue to page. Invalid: redirect to /login
 */

export async function middleware(request: NextRequest) {
  // Get refresh token from cookies
  const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;

  // No token = not logged in
  if (!refreshToken) {
    return redirectToLogin(request, 'no_token');
  }

  // Verify the token
  const payload = await verifyToken(refreshToken);

  // Invalid token (expired, malformed, wrong signature)
  if (!payload) {
    return redirectToLogin(request, 'invalid_token');
  }

  // Must be a refresh token (not an access token)
  if (payload.type !== 'refresh') {
    return redirectToLogin(request, 'wrong_token_type');
  }

  // Token valid - continue to page
  // Optionally add member ID to headers for server components
  const response = NextResponse.next();
  response.headers.set('x-member-id', payload.sub);

  return response;
}

/**
 * Redirect to Express login page with optional reason
 * Uses the Express app URL (goes through proxy or directly)
 */
function redirectToLogin(request: NextRequest, reason?: string): NextResponse {
  // Build login URL - use origin to stay on same host
  // This works because Express (port 4000) proxies to us
  const loginUrl = new URL('/login', request.url);

  // Add return URL so user comes back after login
  loginUrl.searchParams.set('returnTo', request.nextUrl.pathname);

  // Add reason in development for debugging
  if (reason && process.env.NODE_ENV === 'development') {
    loginUrl.searchParams.set('reason', reason);
  }

  return NextResponse.redirect(loginUrl);
}

/**
 * Middleware matcher configuration
 * Only run on protected routes (our member and admin pages)
 */
export const config = {
  matcher: [
    /*
     * Match all paths starting with /dashboard or /admin
     * Excludes:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, images, etc.
     *
     * Note: Admin pages use Bearer token from localStorage, not cookies.
     * The middleware validates member tokens but admin pages handle
     * their own authentication via localStorage token.
     */
    '/dashboard/:path*',
    '/admin/:path*',
  ],
};
