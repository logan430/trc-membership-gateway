/**
 * Admin email template management routes
 * Templates are stored in database and editable by super admins
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireSuperAdmin } from '../../admin/middleware.js';
import { logAuditEvent, AuditAction } from '../../lib/audit.js';
import { prisma } from '../../lib/prisma.js';

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
  const { name } = req.params;

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
 * Update or create an email template (super admin only)
 */
adminTemplatesRouter.put(
  '/:name',
  requireAdmin,
  requireSuperAdmin,
  async (req, res) => {
    const { name } = req.params;
    const admin = res.locals.admin!;

    try {
      const { subject, body } = updateTemplateSchema.parse(req.body);

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
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid request', details: error.errors });
        return;
      }
      throw error;
    }
  }
);

/**
 * Default email templates derived from hardcoded templates
 * Used for seeding
 */
const DEFAULT_TEMPLATES = [
  {
    name: 'welcome',
    subject: 'Welcome to The Revenue Council',
    body: `Hark! Thy payment hath been received and thy journey begins.

Welcome to The Revenue Council, a guild of entrepreneurs united in purpose.

To claim thy rightful place in our Discord halls, visit:
{{claimUrl}}

This link shall connect thy Discord account and grant thee access to the guild.

May thy membership bring prosperity and connection.

The Gatekeeper
The Revenue Council

---
Questions? Reply to this email or contact support@revenuecouncil.com`,
  },
  {
    name: 'claim_reminder',
    subject: 'Thy Discord access awaits',
    body: `Hark! A gentle reminder from The Revenue Council.

Thou hast paid for membership but hast not yet claimed thy Discord access.

Visit this link to connect thy Discord and join the guild:
{{claimUrl}}

The community awaits thy arrival.

The Gatekeeper
The Revenue Council`,
  },
  {
    name: 'claim_reminder_cheeky',
    subject: 'We miss thee at The Revenue Council',
    body: `Hail, valued member of The Revenue Council!

We are grateful for thy continued subscription - truly, thy support is appreciated.

Yet we cannot help but notice thou hast not yet claimed thy Discord access. The halls of the guild await thy presence!

Our community of entrepreneurs grows richer with each member who participates. We would be honored to have thee among us.

Claim thy access: {{claimUrl}}

Until we meet in the guild halls,

The Gatekeeper
The Revenue Council`,
  },
  {
    name: 'payment_failure',
    subject: 'Action needed: Payment issue with The Revenue Council',
    body: `Hark! A message from The Treasury.

A payment for thy membership with The Revenue Council hath encountered difficulties.

WHAT HAPPENS NEXT:
- Thou hast {{gracePeriodHours}} hours to resolve this matter whilst retaining full access
- After the grace period: Thy access shall be restricted to #billing-support only
- After 30 days in restricted state: Thy membership shall end entirely

UPDATE THY PAYMENT:
{{portalUrl}}

COMMON CAUSES:
- Expired card on file
- Insufficient funds
- Bank declined the transaction

We urge thee to act swiftly. The Council values thy presence and wishes to see this matter resolved.

Faithfully,
The Treasury

---
If thou hast questions, reply to this message.`,
  },
  {
    name: 'payment_recovered',
    subject: 'Payment received - Welcome back!',
    body: `Huzzah! The Treasury brings glad tidings!

Thy payment hath been received and thy standing with The Revenue Council remaineth intact.

We thank thee for thy swift attention to this matter. Thy membership continues uninterrupted.

The Council celebrates thy continued membership!

Faithfully,
The Treasury

---
If thou hast questions, reply to this message.`,
  },
  {
    name: 'payment_recovered_debtor',
    subject: 'Payment received - Welcome back!',
    body: `Huzzah! The Treasury brings most excellent tidings!

Thy payment hath been received and thy full access to The Revenue Council is now restored!

Thou art no longer restricted - all chambers of the guild are once again open to thee.

The Council celebrates thy return! May thy continued membership bring prosperity to all.

Welcome back, valued member.

Faithfully,
The Treasury

---
If thou hast questions, reply to this message.`,
  },
  {
    name: 'seat_invite',
    subject: "You're invited to join {{teamName}} at The Revenue Council",
    body: `Hail!

Someone from {{teamName}} hath invited thee to join The Revenue Council.

WHAT IS THE REVENUE COUNCIL?

The Revenue Council is a professional community of entrepreneurs united in purpose. We gather in our Discord halls for:
- Networking with fellow business owners
- Referrals and collaboration opportunities
- Peer support and knowledge sharing
- Exclusive resources and discussions

THY INVITATION

{{teamName}} hath granted thee a seat. This means thy membership is covered through their company subscription.

TO CLAIM THY SEAT:

1. Visit: {{claimUrl}}
2. Connect thy Discord account
3. Join our Discord server
4. Introduce thyself in #introductions

Note: Once introduced, thou shalt have full access to the guild.

Note: This invitation doth not expire. Claim it when thou art ready.

We look forward to welcoming thee to the guild!

The Gatekeeper
The Revenue Council

---
Questions about this invitation? Contact thy organization admin at {{teamName}}.
Questions about The Revenue Council? Reply to this email.`,
  },
  {
    name: 'reconciliation_report',
    subject: '[TRC Reconciliation] {{issuesFound}} drift issue(s) detected',
    body: `The Revenue Council - Reconciliation Report
============================================

{{issuesFound}} drift issue(s) detected between Stripe and Discord.

{{fixStatus}}

Summary:
{{summaryText}}

Run ID: {{runId}}

---
This is an automated report from The Revenue Council membership system.
To enable automatic fixes, set RECONCILIATION_AUTO_FIX=true.`,
  },
];

/**
 * POST /admin/templates/seed
 * Seed default email templates (super admin only)
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
  const { name } = req.params;

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
