/**
 * Admin email template management routes
 * Templates are stored in database and editable by all admins
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireSuperAdmin } from '../../admin/middleware.js';
import { logAuditEvent, AuditAction } from '../../lib/audit.js';
import { prisma } from '../../lib/prisma.js';
import { DEFAULT_TEMPLATES, TEMPLATE_VARIABLES, validateVariables } from '../../email/template-fetcher.js';

export const adminTemplatesRouter = Router();

/**
 * GET /admin/templates
 * List all email templates
 */
adminTemplatesRouter.get('/', requireAdmin, async (req, res) => {
  const templates = await prisma.emailTemplate.findMany({
    orderBy: { name: 'asc' },
  });
  res.json({ templates });
});

/**
 * GET /admin/templates/:name
 * Get a specific template by name
 */
adminTemplatesRouter.get('/:name', requireAdmin, async (req, res) => {
  const name = req.params.name as string;

  const template = await prisma.emailTemplate.findUnique({
    where: { name },
  });

  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  res.json({ template });
});

// Schema for template update
const updateTemplateSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
});

/**
 * PUT /admin/templates/:name
 * Update or create an email template (all admins can edit)
 */
adminTemplatesRouter.put('/:name', requireAdmin, async (req, res) => {
  const name = req.params.name as string;
  const admin = res.locals.admin!;

  try {
    const { subject, body } = updateTemplateSchema.parse(req.body);

    // Validate variables in subject and body
    const subjectValidation = validateVariables(name, subject);
    const bodyValidation = validateVariables(name, body);
    const unknownVariables = [
      ...subjectValidation.unknownVariables,
      ...bodyValidation.unknownVariables,
    ];
    // Dedupe unknown variables
    const uniqueUnknown = [...new Set(unknownVariables)];

    // Get current template for comparison
    const currentTemplate = await prisma.emailTemplate.findUnique({
      where: { name },
    });

    // Upsert template
    const template = await prisma.emailTemplate.upsert({
      where: { name },
      update: {
        subject,
        body,
        updatedBy: admin.id,
      },
      create: {
        name,
        subject,
        body,
        updatedBy: admin.id,
      },
    });

    // Log audit event with old/new preview
    await logAuditEvent({
      action: AuditAction.EMAIL_TEMPLATE_UPDATED,
      entityType: 'EmailTemplate',
      entityId: name,
      details: {
        previousSubject: currentTemplate?.subject || null,
        newSubject: subject,
        previousBodyPreview: currentTemplate?.body.slice(0, 100) || null,
        newBodyPreview: body.slice(0, 100),
      },
      performedBy: admin.id,
    });

    res.json({
      success: true,
      template,
      warning:
        uniqueUnknown.length > 0
          ? `Unknown variables detected: ${uniqueUnknown.join(', ')}`
          : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.issues });
      return;
    }
    throw error;
  }
});

/**
 * POST /admin/templates/seed
 * Seed default email templates (super admin only)
 * Uses DEFAULT_TEMPLATES from template-fetcher.ts
 */
adminTemplatesRouter.post(
  '/seed',
  requireAdmin,
  requireSuperAdmin,
  async (req, res) => {
    const admin = res.locals.admin!;

    // Count how many will be created
    const existingNames = await prisma.emailTemplate.findMany({
      select: { name: true },
    });
    const existingSet = new Set(existingNames.map((t) => t.name));
    const newTemplates = DEFAULT_TEMPLATES.filter((t) => !existingSet.has(t.name));

    // Create templates that don't exist
    await prisma.emailTemplate.createMany({
      data: DEFAULT_TEMPLATES,
      skipDuplicates: true,
    });

    // Log audit event
    await logAuditEvent({
      action: AuditAction.EMAIL_TEMPLATES_SEEDED,
      entityType: 'EmailTemplate',
      entityId: 'all',
      details: {
        message: 'Default email templates seeded',
        templatesCreated: newTemplates.map((t) => t.name),
      },
      performedBy: admin.id,
    });

    res.json({
      success: true,
      created: newTemplates.length,
    });
  }
);

/**
 * Sample data for template preview
 */
const SAMPLE_DATA: Record<string, Record<string, string>> = {
  welcome: {
    claimUrl: 'https://example.com/claim/abc123',
  },
  claim_reminder: {
    claimUrl: 'https://example.com/claim/abc123',
  },
  claim_reminder_cheeky: {
    claimUrl: 'https://example.com/claim/abc123',
  },
  payment_failure: {
    gracePeriodHours: '48',
    portalUrl: 'https://billing.stripe.com/p/session/xxx',
  },
  payment_recovered: {},
  payment_recovered_debtor: {},
  seat_invite: {
    teamName: 'Acme Corp',
    claimUrl: 'https://example.com/team/invite/claim?token=abc123',
    seatTier: 'TEAM_MEMBER',
  },
  reconciliation_report: {
    issuesFound: '3',
    fixStatus: 'Auto-fix is ENABLED. 2 issues were automatically corrected.',
    summaryText: '- Member abc@example.com: missing Knight role\n- Member xyz@example.com: has Lord role but subscription cancelled',
    runId: 'clxyz123',
  },
};

/**
 * GET /admin/templates/:name/preview
 * Preview a template with sample data
 */
adminTemplatesRouter.get('/:name/preview', requireAdmin, async (req, res) => {
  const name = req.params.name as string;

  const template = await prisma.emailTemplate.findUnique({
    where: { name },
  });

  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  // Get sample data for this template
  const sampleData = SAMPLE_DATA[name] || {};

  // Replace {{variables}} with sample values
  let subject = template.subject;
  let body = template.body;

  for (const [key, value] of Object.entries(sampleData)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    subject = subject.replace(regex, value);
    body = body.replace(regex, value);
  }

  res.json({
    preview: {
      subject,
      body,
    },
    sampleData,
  });
});

/**
 * POST /admin/templates/:name/reset
 * Reset template to default content
 */
adminTemplatesRouter.post('/:name/reset', requireAdmin, async (req, res) => {
  const name = req.params.name as string;
  const admin = res.locals.admin!;

  // Find default template
  const defaultTemplate = DEFAULT_TEMPLATES.find((t) => t.name === name);
  if (!defaultTemplate) {
    res.status(404).json({ error: 'No default template exists for this name' });
    return;
  }

  // Get current for audit comparison
  const currentTemplate = await prisma.emailTemplate.findUnique({
    where: { name },
  });

  // Upsert with default values
  const template = await prisma.emailTemplate.upsert({
    where: { name },
    update: {
      subject: defaultTemplate.subject,
      body: defaultTemplate.body,
      updatedBy: admin.id,
    },
    create: {
      name: defaultTemplate.name,
      subject: defaultTemplate.subject,
      body: defaultTemplate.body,
      updatedBy: admin.id,
    },
  });

  // Log audit event
  await logAuditEvent({
    action: AuditAction.EMAIL_TEMPLATE_RESET,
    entityType: 'EmailTemplate',
    entityId: name,
    details: {
      previousSubject: currentTemplate?.subject || null,
      resetTo: 'default',
    },
    performedBy: admin.id,
  });

  res.json({
    success: true,
    template,
    message: 'Template reset to default',
  });
});

/**
 * GET /admin/templates/:name/variables
 * Get available variables for a template
 */
adminTemplatesRouter.get('/:name/variables', requireAdmin, async (req, res) => {
  const name = req.params.name as string;
  const variables = TEMPLATE_VARIABLES[name] || [];
  res.json({ variables });
});
