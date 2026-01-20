import { Router } from 'express';
import { z } from 'zod';
import cookie from 'cookie';
import { prisma } from '../../lib/prisma.js';
import { verifyPassword } from '../../lib/password.js';
import {
  createAdminAccessToken,
  createAdminRefreshToken,
  verifyAdminToken,
  ADMIN_REFRESH_COOKIE_NAME,
  ADMIN_REFRESH_COOKIE_OPTIONS,
} from '../../admin/auth.js';

export const adminAuthRouter = Router();

// Login schema
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * POST /admin/auth/login
 * Authenticate admin with email and password
 */
adminAuthRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Find admin by email (case insensitive)
    const admin = await prisma.admin.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
      },
    });

    // Anti-enumeration: same response for not found
    if (!admin) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Verify password
    const isValid = await verifyPassword(admin.passwordHash, password);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Update last login timestamp
    await prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    // Create tokens
    const accessToken = await createAdminAccessToken(admin.id, admin.role);
    const refreshToken = await createAdminRefreshToken(admin.id, admin.role);

    // Set refresh token in httpOnly cookie
    res.setHeader(
      'Set-Cookie',
      cookie.serialize(ADMIN_REFRESH_COOKIE_NAME, refreshToken, ADMIN_REFRESH_COOKIE_OPTIONS)
    );

    res.json({
      accessToken,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.errors });
      return;
    }
    throw error;
  }
});

/**
 * POST /admin/auth/refresh
 * Exchange refresh token for new access and refresh tokens
 */
adminAuthRouter.post('/refresh', async (req, res) => {
  // Parse cookies from request
  const cookies = cookie.parse(req.headers.cookie || '');
  const refreshToken = cookies[ADMIN_REFRESH_COOKIE_NAME];

  if (!refreshToken) {
    res.status(401).json({ error: 'No refresh token' });
    return;
  }

  // Verify token
  const payload = await verifyAdminToken(refreshToken);

  if (!payload || payload.type !== 'refresh') {
    res.status(401).json({ error: 'Invalid refresh token' });
    return;
  }

  // Fetch admin (may have been deleted)
  const admin = await prisma.admin.findUnique({
    where: { id: payload.sub },
  });

  if (!admin) {
    res.status(401).json({ error: 'Admin not found' });
    return;
  }

  // Create new tokens (rotation)
  const accessToken = await createAdminAccessToken(admin.id, admin.role);
  const newRefreshToken = await createAdminRefreshToken(admin.id, admin.role);

  // Set new refresh token cookie
  res.setHeader(
    'Set-Cookie',
    cookie.serialize(ADMIN_REFRESH_COOKIE_NAME, newRefreshToken, ADMIN_REFRESH_COOKIE_OPTIONS)
  );

  res.json({
    accessToken,
    admin: {
      id: admin.id,
      email: admin.email,
      role: admin.role,
    },
  });
});

/**
 * POST /admin/auth/logout
 * Clear admin refresh token cookie
 */
adminAuthRouter.post('/logout', (req, res) => {
  // Clear cookie by setting maxAge to 0
  res.setHeader(
    'Set-Cookie',
    cookie.serialize(ADMIN_REFRESH_COOKIE_NAME, '', {
      ...ADMIN_REFRESH_COOKIE_OPTIONS,
      maxAge: 0,
    })
  );

  res.json({ success: true });
});
