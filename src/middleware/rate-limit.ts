import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for /auth/login
 * Prevents brute force password attacks
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * Rate limiter for /auth/signup
 * Prevents account creation spam (stricter limit)
 */
export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per window
  message: { error: 'Too many signup attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for /auth/magic-link/request
 * Prevents email bombing via magic links
 */
export const magicLinkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // 3 requests per window
  message: { error: 'Too many magic link requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for /admin/auth/login
 * Prevents brute force attacks on admin accounts
 */
export const adminAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { error: 'Too many admin login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for /auth/forgot-password and /auth/reset-password
 * Prevents email bombing and reset token brute force
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // 3 attempts per window
  message: { error: 'Too many password reset attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for file uploads
 * SEC-07: 5 files per hour per admin
 *
 * Note: This limiter should be applied AFTER requireAdmin middleware
 * so res.locals.admin is populated for the key generator.
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 files per hour per admin
  message: { error: 'Upload limit reached. You can upload up to 5 files per hour.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    // Key by admin ID from authenticated session (set by requireAdmin middleware)
    const adminId = res.locals?.admin?.id || req.ip || 'anonymous';
    return `upload:${adminId}`;
  },
});
