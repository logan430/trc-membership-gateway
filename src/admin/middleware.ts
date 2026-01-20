import type { Request, Response, NextFunction } from 'express';
import { verifyAdminToken } from './auth.js';
import { prisma } from '../lib/prisma.js';
import type { Admin } from '@prisma/client';

// Extend Express Response.locals to include admin
declare module 'express-serve-static-core' {
  interface Locals {
    admin?: Admin;
  }
}

/**
 * Middleware that requires a valid admin token
 * Extracts token from Authorization header (Bearer token)
 * Attaches admin to res.locals.admin on success
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix
  const payload = await verifyAdminToken(token);

  if (!payload) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Fetch admin from database (may have been deleted since token was issued)
  const admin = await prisma.admin.findUnique({
    where: { id: payload.sub },
  });

  if (!admin) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Attach admin to response locals for use in route handlers
  res.locals.admin = admin;
  next();
}

/**
 * Middleware that requires super admin role
 * MUST be used after requireAdmin middleware
 */
export async function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const admin = res.locals.admin;

  if (!admin) {
    // requireAdmin wasn't called first or failed
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (admin.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Super admin access required' });
    return;
  }

  next();
}
