import { prisma } from './prisma.js';

// Audit action types for consistent logging
export const AuditAction = {
  // Admin actions
  ADMIN_LOGIN: 'ADMIN_LOGIN',
  ADMIN_CREATED: 'ADMIN_CREATED',
  ADMIN_DELETED: 'ADMIN_DELETED',
  ADMIN_ROLE_CHANGED: 'ADMIN_ROLE_CHANGED',

  // Member access control actions
  MEMBER_ACCESS_REVOKED: 'MEMBER_ACCESS_REVOKED',
  MEMBER_CLAIM_RESET: 'MEMBER_CLAIM_RESET',
  MEMBER_ROLE_GRANTED: 'MEMBER_ROLE_GRANTED',

  // Configuration actions
  FEATURE_FLAG_TOGGLED: 'FEATURE_FLAG_TOGGLED',
  FEATURE_FLAGS_SEEDED: 'FEATURE_FLAGS_SEEDED',
  EMAIL_TEMPLATE_UPDATED: 'EMAIL_TEMPLATE_UPDATED',
  EMAIL_TEMPLATE_RESET: 'EMAIL_TEMPLATE_RESET',
  EMAIL_TEMPLATES_SEEDED: 'EMAIL_TEMPLATES_SEEDED',

  // Bulk actions
  BULK_ACTION_PERFORMED: 'BULK_ACTION_PERFORMED',
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

export type EntityType = 'Admin' | 'Member' | 'Team' | 'FeatureFlag' | 'EmailTemplate';

/**
 * Log an audit event to the database
 * All admin actions should be logged for accountability
 */
export async function logAuditEvent(params: {
  action: string;
  entityType: EntityType;
  entityId: string;
  details?: Record<string, unknown>;
  performedBy: string; // Admin ID or 'system'
  reason?: string; // Required for destructive actions
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      details: {
        ...params.details,
        ...(params.reason ? { reason: params.reason } : {}),
      },
      performedBy: params.performedBy,
    },
  });
}

/**
 * Get recent audit logs for a specific entity
 * Useful for showing action history on member detail pages
 */
export async function getEntityAuditLogs(
  entityType: string,
  entityId: string,
  limit = 50
) {
  return prisma.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
