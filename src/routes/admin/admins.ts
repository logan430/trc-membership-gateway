import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireAdmin, requireSuperAdmin } from '../../admin/middleware.js';
import { hashPassword } from '../../lib/password.js';
import { logAuditEvent, AuditAction } from '../../lib/audit.js';

export const adminAdminsRouter = Router();

// All routes require super admin access
adminAdminsRouter.use(requireAdmin, requireSuperAdmin);

// Schema definitions
const createAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['ADMIN', 'SUPER_ADMIN']).default('ADMIN'),
});

const updateRoleSchema = z.object({
  role: z.enum(['ADMIN', 'SUPER_ADMIN']),
});

const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/**
 * GET /admin/admins
 * List all admin accounts (super admin only)
 */
adminAdminsRouter.get('/', async (req, res) => {
  const admins = await prisma.admin.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      lastLoginAt: true,
      createdAt: true,
      createdBy: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ admins });
});

/**
 * GET /admin/admins/:id
 * Get single admin with their audit log of actions performed
 */
adminAdminsRouter.get('/:id', async (req, res) => {
  const { id } = req.params;

  const admin = await prisma.admin.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      role: true,
      lastLoginAt: true,
      createdAt: true,
      createdBy: true,
    },
  });

  if (!admin) {
    res.status(404).json({ error: 'Admin not found' });
    return;
  }

  // Get audit logs for actions this admin performed
  const actionsPerformed = await prisma.auditLog.findMany({
    where: { performedBy: id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  res.json({ admin, actionsPerformed });
});

/**
 * POST /admin/admins
 * Create a new admin account (super admin only)
 */
adminAdminsRouter.post('/', async (req, res) => {
  try {
    const { email, password, role } = createAdminSchema.parse(req.body);
    const currentAdmin = res.locals.admin!;

    // Check if email already exists (case insensitive)
    const existingAdmin = await prisma.admin.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
      },
    });

    if (existingAdmin) {
      res.status(400).json({ error: 'Email already in use' });
      return;
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create admin
    const newAdmin = await prisma.admin.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        role,
        createdBy: currentAdmin.id,
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    // Log audit event
    await logAuditEvent({
      action: AuditAction.ADMIN_CREATED,
      entityType: 'Admin',
      entityId: newAdmin.id,
      details: { email: newAdmin.email, role: newAdmin.role },
      performedBy: currentAdmin.id,
    });

    res.status(201).json({ admin: newAdmin });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.issues });
      return;
    }
    throw error;
  }
});

/**
 * PATCH /admin/admins/:id/role
 * Change an admin's role (super admin only)
 * Self-demotion blocked if only super admin
 */
adminAdminsRouter.patch('/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role: newRole } = updateRoleSchema.parse(req.body);
    const currentAdmin = res.locals.admin!;

    // Find target admin
    const targetAdmin = await prisma.admin.findUnique({
      where: { id },
    });

    if (!targetAdmin) {
      res.status(404).json({ error: 'Admin not found' });
      return;
    }

    // Self-demotion check
    if (id === currentAdmin.id && newRole === 'ADMIN') {
      // Demoting self - check if there's another super admin
      const superAdminCount = await prisma.admin.count({
        where: { role: 'SUPER_ADMIN' },
      });

      if (superAdminCount === 1) {
        res.status(400).json({ error: 'Cannot demote the only super admin' });
        return;
      }
    }

    const oldRole = targetAdmin.role;

    // Update role
    const updatedAdmin = await prisma.admin.update({
      where: { id },
      data: { role: newRole },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    // Log audit event
    await logAuditEvent({
      action: AuditAction.ADMIN_ROLE_CHANGED,
      entityType: 'Admin',
      entityId: id,
      details: { oldRole, newRole, email: updatedAdmin.email },
      performedBy: currentAdmin.id,
    });

    res.json({ admin: updatedAdmin });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.issues });
      return;
    }
    throw error;
  }
});

/**
 * DELETE /admin/admins/:id
 * Delete an admin account (super admin only)
 * Self-deletion blocked
 */
adminAdminsRouter.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const currentAdmin = res.locals.admin!;

  // Self-delete check
  if (id === currentAdmin.id) {
    res.status(400).json({ error: 'Cannot delete your own account' });
    return;
  }

  // Find target admin
  const targetAdmin = await prisma.admin.findUnique({
    where: { id },
  });

  if (!targetAdmin) {
    res.status(404).json({ error: 'Admin not found' });
    return;
  }

  // Delete admin
  await prisma.admin.delete({
    where: { id },
  });

  // Log audit event
  await logAuditEvent({
    action: AuditAction.ADMIN_DELETED,
    entityType: 'Admin',
    entityId: id,
    details: { email: targetAdmin.email, role: targetAdmin.role },
    performedBy: currentAdmin.id,
  });

  res.json({ success: true });
});

/**
 * POST /admin/admins/:id/reset-password
 * Reset another admin's password (super admin only)
 */
adminAdminsRouter.post('/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = resetPasswordSchema.parse(req.body);
    const currentAdmin = res.locals.admin!;

    // Find target admin
    const targetAdmin = await prisma.admin.findUnique({
      where: { id },
    });

    if (!targetAdmin) {
      res.status(404).json({ error: 'Admin not found' });
      return;
    }

    // Hash new password
    const passwordHash = await hashPassword(password);

    // Update password
    await prisma.admin.update({
      where: { id },
      data: { passwordHash },
    });

    // Log audit event (don't include password!)
    await logAuditEvent({
      action: 'ADMIN_PASSWORD_RESET',
      entityType: 'Admin',
      entityId: id,
      details: { email: targetAdmin.email },
      performedBy: currentAdmin.id,
    });

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.issues });
      return;
    }
    throw error;
  }
});
