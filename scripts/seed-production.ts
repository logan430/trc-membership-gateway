/**
 * Production Seed Script
 *
 * Seeds operational data required for the production environment:
 * - Admin account (from env vars ADMIN_SEED_EMAIL + ADMIN_SEED_PASSWORD)
 * - Feature flags (8 flags with production-appropriate defaults)
 * - Point configs (4 configurable actions with correct point values)
 * - Email templates (10 notification templates)
 *
 * All operations are idempotent (upsert / createMany + skipDuplicates).
 * Does NOT create any test member accounts -- this is production only.
 *
 * Run: ADMIN_SEED_EMAIL=x ADMIN_SEED_PASSWORD=y npx tsx scripts/seed-production.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { hashPassword } from '../src/lib/password.js';
import 'dotenv/config';

// --- Database connection (same pattern as seed-test-data.ts) ---
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// --- Seed Data Definitions ---
// Inlined here to avoid transitive imports that may trigger Zod env validation.

const DEFAULT_FLAGS = [
  {
    key: 'require_introduction',
    enabled: true,
    description: 'Require introduction message before granting full access',
    category: 'onboarding',
  },
  {
    key: 'send_claim_reminders',
    enabled: true,
    description: "Send reminder emails to members who haven't claimed Discord access",
    category: 'email',
  },
  {
    key: 'send_billing_emails',
    enabled: true,
    description: 'Send billing failure and recovery notification emails',
    category: 'email',
  },
  {
    key: 'send_invite_emails',
    enabled: true,
    description: 'Send team seat invitation emails',
    category: 'email',
  },
  {
    key: 'auto_fix_reconciliation',
    enabled: false,
    description: 'Automatically fix drift issues detected during reconciliation',
    category: 'operations',
  },
  {
    key: 'enable_magic_links',
    enabled: true,
    description: 'Enable magic link login for passwordless authentication',
    category: 'auth',
  },
  {
    key: 'enable_team_signups',
    enabled: true,
    description: 'Allow new company plan signups',
    category: 'billing',
  },
  {
    key: 'maintenance_mode',
    enabled: false,
    description: 'Block all non-admin operations (maintenance mode)',
    category: 'general',
  },
];

const DEFAULT_POINT_CONFIGS = [
  {
    action: 'benchmark_submission',
    points: 50,
    enabled: true,
    label: 'Benchmark Submission',
    description: 'Points awarded for submitting benchmark data',
  },
  {
    action: 'resource_download',
    points: 5,
    enabled: true,
    label: 'Resource Download',
    description: 'Points awarded for downloading a resource',
  },
  {
    action: 'discord_activity',
    points: 1,
    enabled: true,
    label: 'Discord Activity',
    description: 'Points awarded per 100 Discord XP synced from MEE6',
  },
  {
    action: 'intro_completed',
    points: 25,
    enabled: true,
    label: 'Introduction Completed',
    description: 'Points awarded for completing introduction',
  },
];

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

{{teamName}} hath granted thee a {{seatTier}} seat. This means thy membership is covered through their company subscription.

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
  {
    name: 'password_reset',
    subject: 'Reset Thy Password - The Revenue Council',
    body: `Hark! A request hath been made to reset thy password.

If thou didst request this password reset, click the link below to set a new password:

{{resetUrl}}

This link shall expire in 1 hour.

If thou didst NOT request a password reset, simply ignore this message. Thy account remaineth secure.

May thy new password be both strong and memorable.

The Gatekeeper
The Revenue Council

---
Questions? Reply to this email.`,
  },
  {
    name: 'password_reset_confirmation',
    subject: 'Thy Password Hath Been Changed - The Revenue Council',
    body: `Hark! Thy password hath been successfully changed.

If thou didst make this change, no further action is required. Thou may now sign in with thy new password.

If thou didst NOT change thy password, please contact us immediately at support@revenuecouncil.com. Thy account may be compromised.

The Gatekeeper
The Revenue Council

---
Questions? Reply to this email.`,
  },
];

// --- Seed Functions ---

async function seedAdmin() {
  console.log('\n--- Seeding Admin ---');

  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD must be set in environment variables.\n' +
      'Usage: ADMIN_SEED_EMAIL=you@example.com ADMIN_SEED_PASSWORD=yourpassword npx tsx scripts/seed-production.ts'
    );
  }

  if (password.length < 8) {
    throw new Error('ADMIN_SEED_PASSWORD must be at least 8 characters (per Zod schema validation).');
  }

  const passwordHash = await hashPassword(password);

  await prisma.admin.upsert({
    where: { email },
    update: {
      passwordHash,
      role: 'SUPER_ADMIN',
    },
    create: {
      email,
      passwordHash,
      role: 'SUPER_ADMIN',
    },
  });

  console.log(`  Admin created/updated: ${email}`);
}

async function seedFeatureFlags() {
  console.log('\n--- Seeding Feature Flags ---');

  const result = await prisma.featureFlag.createMany({
    data: DEFAULT_FLAGS,
    skipDuplicates: true,
  });

  console.log(`  Feature flags seeded (${DEFAULT_FLAGS.length} flags, ${result.count} new)`);
}

async function seedPointConfigs() {
  console.log('\n--- Seeding Point Configs ---');

  const result = await prisma.pointConfig.createMany({
    data: DEFAULT_POINT_CONFIGS,
    skipDuplicates: true,
  });

  console.log(`  Point configs seeded (${DEFAULT_POINT_CONFIGS.length} configs, ${result.count} new)`);
}

async function seedEmailTemplates() {
  console.log('\n--- Seeding Email Templates ---');

  const result = await prisma.emailTemplate.createMany({
    data: DEFAULT_TEMPLATES,
    skipDuplicates: true,
  });

  console.log(`  Email templates seeded (${DEFAULT_TEMPLATES.length} templates, ${result.count} new)`);
}

// --- Main ---

async function main() {
  console.log('Starting production seed...');

  try {
    await seedAdmin();
    await seedFeatureFlags();
    await seedPointConfigs();
    await seedEmailTemplates();

    console.log('\nProduction seed complete!');
  } catch (error) {
    console.error('\nProduction seed FAILED:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
