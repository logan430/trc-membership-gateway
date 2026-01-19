# Phase 7: Email Notifications - Research

**Researched:** 2026-01-19
**Domain:** Transactional email infrastructure, scheduled email triggers, provider abstraction
**Confidence:** HIGH

## Summary

Phase 7 adds transactional email infrastructure to complement the existing Discord DM notifications. The CONTEXT.md specifies: plain text only, medieval-themed copy, provider-agnostic implementation, and a claim reminder sequence (48h, 7d, 30d, monthly). The phase does NOT add new membership features - it adds email delivery to existing lifecycle events already triggered by webhooks and the billing scheduler.

The implementation extends the existing `src/billing/notifications.ts` pattern (which sends Discord DMs) to also send emails through an abstracted email provider interface. The scheduler pattern from Phase 6 (`src/billing/scheduler.ts`) serves as the template for the claim reminder scheduler. All email triggers integrate with existing webhook handlers and the billing notification cadence.

**Primary recommendation:** Use Resend as the email provider (modern, developer-friendly, excellent deliverability, generous free tier). Implement a provider-agnostic interface (`EmailProvider`) so the provider can be swapped without code changes. Store plain text templates as TypeScript string functions - no template engine needed for simple, text-only emails.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| resend | ^6.7.0 | Transactional email API | Modern, developer-friendly, excellent DX, 3K free emails/month |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| prisma | ^7.2.0 | Track sent emails, claim reminders | Already installed |
| zod | ^4.3.5 | Validate email addresses | Already installed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Resend | SendGrid | More mature but less developer-friendly, complex pricing |
| Resend | Postmark | Excellent deliverability but more expensive |
| Resend | Nodemailer/SMTP | No external dependency but requires SMTP server, deliverability issues |
| Resend | Amazon SES | Cheapest at scale but complex setup, poor DX |

**Installation:**
```bash
npm install resend
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  email/
    provider.ts          # EmailProvider interface + factory
    providers/
      resend.ts          # Resend implementation
      console.ts         # Development/test stub (logs to console)
    templates.ts         # Plain text email template functions
    send.ts              # High-level send functions (sendWelcomeEmail, etc.)
  billing/
    notifications.ts     # Extended: add email alongside DM
    scheduler.ts         # Extended: add claim reminder schedule
```

### Pattern 1: Provider Abstraction Interface
**What:** Abstract email sending behind a provider-agnostic interface
**When to use:** Always - enables provider switching without code changes
**Example:**
```typescript
// src/email/provider.ts

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailResult>;
}

// Factory function - reads from env to determine provider
export function createEmailProvider(): EmailProvider {
  const provider = process.env.EMAIL_PROVIDER ?? 'console';

  switch (provider) {
    case 'resend':
      return new ResendProvider(process.env.RESEND_API_KEY!);
    case 'console':
    default:
      return new ConsoleProvider();
  }
}
```

### Pattern 2: Resend Provider Implementation
**What:** Concrete implementation of EmailProvider using Resend SDK
**When to use:** Production email sending
**Example:**
```typescript
// src/email/providers/resend.ts
// Source: https://resend.com/docs/api-reference/emails/send-email

import { Resend } from 'resend';
import type { EmailProvider, EmailMessage, EmailResult } from '../provider.js';

export class ResendProvider implements EmailProvider {
  private client: Resend;
  private fromAddress: string;

  constructor(apiKey: string, fromAddress = 'The Revenue Council <noreply@revenuecouncil.com>') {
    this.client = new Resend(apiKey);
    this.fromAddress = fromAddress;
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    try {
      const { data, error } = await this.client.emails.send({
        from: this.fromAddress,
        to: message.to,
        subject: message.subject,
        text: message.text,
        replyTo: message.replyTo ?? 'support@revenuecouncil.com',
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, messageId: data?.id };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: errorMsg };
    }
  }
}
```

### Pattern 3: Console Provider for Development
**What:** Stub provider that logs emails instead of sending
**When to use:** Development, testing, when email is not configured
**Example:**
```typescript
// src/email/providers/console.ts

import type { EmailProvider, EmailMessage, EmailResult } from '../provider.js';
import { logger } from '../../index.js';

export class ConsoleProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<EmailResult> {
    logger.info(
      {
        to: message.to,
        subject: message.subject,
        textLength: message.text.length,
      },
      'EMAIL (console): Would send email'
    );
    logger.debug({ text: message.text }, 'EMAIL content');

    return { success: true, messageId: `console-${Date.now()}` };
  }
}
```

### Pattern 4: Plain Text Template Functions
**What:** TypeScript functions that return email text with variable interpolation
**When to use:** All email templates - no template engine needed
**Example:**
```typescript
// src/email/templates.ts

interface WelcomeEmailParams {
  claimUrl: string;
}

export function welcomeEmailTemplate(params: WelcomeEmailParams): { subject: string; text: string } {
  return {
    subject: 'Welcome to The Revenue Council',
    text: `Hark! Thy payment hath been received and thy journey begins.

Welcome to The Revenue Council, a guild of entrepreneurs united in purpose.

To claim thy rightful place in our Discord halls, visit:
${params.claimUrl}

This link shall connect thy Discord account and grant thee access to the guild.

May thy membership bring prosperity and connection.

The Gatekeeper
The Revenue Council

---
Questions? Reply to this email or contact support@revenuecouncil.com`,
  };
}

interface ClaimReminderParams {
  claimUrl: string;
  daysSincePurchase: number;
}

export function claimReminderEmailTemplate(params: ClaimReminderParams): { subject: string; text: string } {
  const isCheeky = params.daysSincePurchase >= 30;

  const subject = isCheeky
    ? 'We miss thee at The Revenue Council'
    : 'Thy Discord access awaits';

  const text = isCheeky
    ? `Hail, valued member of The Revenue Council!

We are grateful for thy continued subscription - truly, thy support is appreciated.

Yet we cannot help but notice thou hast not yet claimed thy Discord access. The halls of the guild await thy presence!

Our community of entrepreneurs grows richer with each member who participates. We would be honored to have thee among us.

Claim thy access: ${params.claimUrl}

Until we meet in the guild halls,

The Gatekeeper
The Revenue Council`
    : `Hark! A gentle reminder from The Revenue Council.

Thou hast paid for membership but hast not yet claimed thy Discord access.

Visit this link to connect thy Discord and join the guild:
${params.claimUrl}

The community awaits thy arrival.

The Gatekeeper
The Revenue Council`;

  return { subject, text };
}

interface PaymentFailureParams {
  portalUrl: string;
  gracePeriodHours: number;
}

export function paymentFailureEmailTemplate(params: PaymentFailureParams): { subject: string; text: string } {
  return {
    subject: 'Action needed: Payment issue with The Revenue Council',
    text: `Hark! The Treasury reports a matter requiring thy attention.

A payment for thy membership hath encountered difficulties.

WHAT HAPPENS NEXT:
- Thou hast ${params.gracePeriodHours} hours to resolve this matter
- After ${params.gracePeriodHours} hours: Thy access shall be restricted to #billing-support
- After 30 days in restricted status: Thy membership shall end

TO RESOLVE:
Update thy payment details at: ${params.portalUrl}

Common causes: expired card, insufficient funds, or bank decline.

The Council values thy presence and hopes to see this resolved swiftly.

The Treasury
The Revenue Council

---
Questions? Reply to this email.`,
  };
}

interface PaymentRecoveredParams {
  wasInDebtorState: boolean;
}

export function paymentRecoveredEmailTemplate(params: PaymentRecoveredParams): { subject: string; text: string } {
  return {
    subject: 'Payment received - Welcome back!',
    text: params.wasInDebtorState
      ? `Huzzah! Thy payment hath been received!

Thy full access to The Revenue Council is now restored. We celebrate thy return to the guild.

May thy continued membership bring prosperity.

The Treasury
The Revenue Council`
      : `Huzzah! Thy payment hath been received.

Thy standing with The Revenue Council remaineth intact. We thank thee for thy swift attention to this matter.

The Treasury
The Revenue Council`,
  };
}

interface SeatInviteParams {
  teamName: string;
  seatTier: 'OWNER' | 'TEAM_MEMBER';
  claimUrl: string;
}

export function seatInviteEmailTemplate(params: SeatInviteParams): { subject: string; text: string } {
  const tierDescription = params.seatTier === 'OWNER'
    ? 'an Owner seat (with access to exclusive owner-only channels)'
    : 'a Team Member seat';

  return {
    subject: `You're invited to join ${params.teamName} at The Revenue Council`,
    text: `Hail!

${params.teamName} hath invited thee to join The Revenue Council.

WHAT IS THE REVENUE COUNCIL?
The Revenue Council is a professional community of entrepreneurs united for networking, referrals, and collaboration. Members connect via our Discord server to share opportunities and build relationships.

THY INVITATION:
Thou hast been granted ${tierDescription} through ${params.teamName}'s company membership.

TO CLAIM THY SEAT:
1. Visit: ${params.claimUrl}
2. Connect thy Discord account
3. Join our Discord server
4. Introduce thyself in #introductions

Once introduced, thou shalt have full access to the guild.

This invitation doth not expire. Claim it when thou art ready.

The Gatekeeper
The Revenue Council

---
Questions about this invitation? Contact thy organization administrator.
Questions about The Revenue Council? Reply to this email.`,
  };
}
```

### Pattern 5: High-Level Send Functions
**What:** Convenience functions that combine template + provider
**When to use:** Called from webhook handlers and schedulers
**Example:**
```typescript
// src/email/send.ts

import { createEmailProvider, type EmailResult } from './provider.js';
import * as templates from './templates.js';
import { logger } from '../index.js';

const emailProvider = createEmailProvider();

export async function sendWelcomeEmail(
  email: string,
  claimUrl: string
): Promise<EmailResult> {
  const { subject, text } = templates.welcomeEmailTemplate({ claimUrl });

  const result = await emailProvider.send({
    to: email,
    subject,
    text,
  });

  logger.info({ email, success: result.success }, 'Welcome email sent');
  return result;
}

export async function sendClaimReminderEmail(
  email: string,
  claimUrl: string,
  daysSincePurchase: number
): Promise<EmailResult> {
  const { subject, text } = templates.claimReminderEmailTemplate({
    claimUrl,
    daysSincePurchase,
  });

  const result = await emailProvider.send({
    to: email,
    subject,
    text,
  });

  logger.info({ email, daysSincePurchase, success: result.success }, 'Claim reminder email sent');
  return result;
}

export async function sendPaymentFailureEmail(
  email: string,
  portalUrl: string,
  gracePeriodHours = 48
): Promise<EmailResult> {
  const { subject, text } = templates.paymentFailureEmailTemplate({
    portalUrl,
    gracePeriodHours,
  });

  const result = await emailProvider.send({
    to: email,
    subject,
    text,
  });

  logger.info({ email, success: result.success }, 'Payment failure email sent');
  return result;
}

export async function sendPaymentRecoveredEmail(
  email: string,
  wasInDebtorState: boolean
): Promise<EmailResult> {
  const { subject, text } = templates.paymentRecoveredEmailTemplate({
    wasInDebtorState,
  });

  const result = await emailProvider.send({
    to: email,
    subject,
    text,
  });

  logger.info({ email, wasInDebtorState, success: result.success }, 'Payment recovered email sent');
  return result;
}

export async function sendSeatInviteEmail(
  email: string,
  teamName: string,
  seatTier: 'OWNER' | 'TEAM_MEMBER',
  claimUrl: string
): Promise<EmailResult> {
  const { subject, text } = templates.seatInviteEmailTemplate({
    teamName,
    seatTier,
    claimUrl,
  });

  const result = await emailProvider.send({
    to: email,
    subject,
    text,
  });

  logger.info({ email, teamName, seatTier, success: result.success }, 'Seat invite email sent');
  return result;
}
```

### Pattern 6: Claim Reminder Scheduler (Database Polling)
**What:** Extend existing billing scheduler pattern to check for unclaimed Discord
**When to use:** Periodic check (piggyback on billing scheduler or separate interval)
**Example:**
```typescript
// Extension to src/billing/scheduler.ts or new src/email/claim-scheduler.ts

import { prisma } from '../lib/prisma.js';
import { sendClaimReminderEmail } from '../email/send.js';
import { logger } from '../index.js';
import { env } from '../config/env.js';

// Claim reminder schedule per CONTEXT.md:
// - 48 hours: First nudge
// - 7 days: Second reminder
// - 30 days: Cheeky email
// - Monthly thereafter
const CLAIM_REMINDER_SCHEDULE = [
  { offsetHours: 48, key: 'claim_48h' },
  { offsetHours: 7 * 24, key: 'claim_7d' },
  { offsetHours: 30 * 24, key: 'claim_30d' },
  // Monthly reminders: 60d, 90d, 120d...
  { offsetHours: 60 * 24, key: 'claim_60d' },
  { offsetHours: 90 * 24, key: 'claim_90d' },
  { offsetHours: 120 * 24, key: 'claim_120d' },
] as const;

export async function processClaimReminders(): Promise<number> {
  const now = new Date();
  let remindersSent = 0;

  // Find members who:
  // - Have active subscription (paid)
  // - Have email address
  // - Do NOT have discordId (haven't claimed)
  const unclaimedMembers = await prisma.member.findMany({
    where: {
      subscriptionStatus: 'ACTIVE',
      email: { not: null },
      discordId: null,
    },
  });

  for (const member of unclaimedMembers) {
    if (!member.email || !member.createdAt) continue;

    const purchaseTime = member.createdAt.getTime();
    const elapsedHours = (now.getTime() - purchaseTime) / (1000 * 60 * 60);

    // Check which reminders should be sent
    for (const reminder of CLAIM_REMINDER_SCHEDULE) {
      if (elapsedHours >= reminder.offsetHours) {
        // Check if already sent (using sentBillingNotifications field - repurpose or add new field)
        if (!member.sentBillingNotifications.includes(reminder.key)) {
          const daysSince = Math.floor(reminder.offsetHours / 24);
          const claimUrl = `${env.APP_URL}/claim?member=${member.id}`;

          try {
            const result = await sendClaimReminderEmail(member.email, claimUrl, daysSince);

            if (result.success) {
              // Mark as sent
              await prisma.member.update({
                where: { id: member.id },
                data: {
                  sentBillingNotifications: { push: reminder.key },
                },
              });
              remindersSent++;
            }
          } catch (error) {
            logger.error(
              { memberId: member.id, reminderKey: reminder.key, error },
              'Failed to send claim reminder email'
            );
          }
        }
      }
    }
  }

  return remindersSent;
}
```

### Anti-Patterns to Avoid
- **Hardcoding provider details in business logic:** Use the provider interface everywhere
- **Sending HTML emails:** CONTEXT.md specifies plain text only
- **Building complex template engines:** Simple string functions are sufficient
- **Not tracking sent emails:** Use database to track what's been sent (idempotency)
- **Sending email synchronously in request path:** Fire-and-forget after webhook ACK
- **Not handling DM and email separately:** DM can fail (user disabled), email can fail (invalid address) - handle independently

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email API integration | Raw HTTP calls | Resend SDK | Error handling, types, retries built-in |
| Template engine | Handlebars/EJS/etc | String template functions | Plain text emails don't need complexity |
| Scheduling | node-cron library | Existing setInterval polling | Already proven in billing scheduler |
| Email validation | Custom regex | Zod `.email()` | Already using Zod everywhere |
| Provider switching | Conditional imports | Interface + factory | Cleaner, testable |

**Key insight:** The codebase already has patterns for scheduled polling (`billing/scheduler.ts`) and notifications (`billing/notifications.ts`). This phase extends these patterns rather than building new infrastructure.

## Common Pitfalls

### Pitfall 1: Email Address Not Available
**What goes wrong:** Member has no email, can't send transactional email
**Why it happens:** Members can claim Discord without providing email (OAuth only gives what Discord shares)
**How to avoid:**
- Capture email during checkout (Stripe has it)
- Store email from Stripe customer object in webhook handler
- For team invites, require email to send invite
**Warning signs:** sendEmail() called with null email

### Pitfall 2: Duplicate Emails on Webhook Retry
**What goes wrong:** Same welcome email sent multiple times
**Why it happens:** Stripe retries webhook, idempotency only checks event processing not email
**How to avoid:**
- Track sent emails in database (like `sentBillingNotifications`)
- Check before sending, mark after sending
**Warning signs:** User complaints about duplicate emails

### Pitfall 3: Welcome Email Before Payment Confirmed
**What goes wrong:** Welcome email sent but payment actually failed
**Why it happens:** Sending on checkout.session.completed but payment not fully processed
**How to avoid:**
- For subscriptions, checkout.session.completed with mode='subscription' means payment succeeded
- Subscription is already active at this point
- This is safe for welcome emails
**Warning signs:** Users receiving welcome emails then payment failures

### Pitfall 4: Team Invite Email Without Team Context
**What goes wrong:** Recipient confused about what they're being invited to
**Why it happens:** Email doesn't explain The Revenue Council or the team
**How to avoid:** CONTEXT.md specifies "full context - what The Revenue Council is, what access they'll get, company name"
**Warning signs:** Support requests asking "what is this?"

### Pitfall 5: Claim Reminder to Already-Claimed Member
**What goes wrong:** Email says "claim your Discord" but member already has access
**Why it happens:** Race condition between claim and reminder check
**How to avoid:**
- Always re-check `discordId` immediately before sending
- Query in scheduler, not stored state
**Warning signs:** Confused members who already have access

### Pitfall 6: Email Provider Rate Limits
**What goes wrong:** Emails silently fail or queue infinitely
**Why it happens:** Batch operations exceed provider rate limits
**How to avoid:**
- Resend: 10 requests/second on free tier
- Add delays between batch sends if needed
- Log all failures, don't swallow errors
**Warning signs:** Low email delivery rate in provider dashboard

### Pitfall 7: Reply-To Goes to Unmonitored Inbox
**What goes wrong:** Users reply expecting support, nobody reads it
**Why it happens:** Using noreply@ or unmapped address
**How to avoid:** CONTEXT.md specifies "Reply-to: Real support inbox that someone monitors (support@...)"
**Warning signs:** User complaints about unanswered emails

## Code Examples

Verified patterns from official sources:

### Resend SDK Usage
```typescript
// Source: https://resend.com/docs/api-reference/emails/send-email

import { Resend } from 'resend';

const resend = new Resend('re_123456789');

// Send plain text email
const { data, error } = await resend.emails.send({
  from: 'The Revenue Council <noreply@revenuecouncil.com>',
  to: ['user@example.com'],
  subject: 'Welcome to The Revenue Council',
  text: 'Plain text content here...',
  replyTo: 'support@revenuecouncil.com',
});

if (error) {
  console.error('Failed to send:', error.message);
} else {
  console.log('Sent with ID:', data?.id);
}
```

### Integrating Email with Existing Webhook
```typescript
// Extension to existing checkout.session.completed handler in src/webhooks/stripe.ts

// After subscription is created and member updated...
// Send welcome email
if (member.email) {
  const claimUrl = `${env.APP_URL}/claim?member=${member.id}`;
  // Fire and forget - don't block webhook response
  sendWelcomeEmail(member.email, claimUrl).catch((err) => {
    logger.error({ memberId: member.id, err }, 'Failed to send welcome email');
  });
}
```

### Integrating Email with Existing Payment Failure Handler
```typescript
// Extension to src/billing/failure-handler.ts

// After DM is sent...
if (member.email) {
  const portalUrl = await createBillingPortalUrl(member.stripeCustomerId);
  sendPaymentFailureEmail(member.email, portalUrl, 48).catch((err) => {
    logger.error({ memberId: member.id, err }, 'Failed to send payment failure email');
  });
}
```

### Environment Configuration
```typescript
// Addition to src/config/env.ts

const envSchema = z.object({
  // ... existing ...

  // Email
  EMAIL_PROVIDER: z.enum(['resend', 'console']).default('console'),
  RESEND_API_KEY: z.string().startsWith('re_').optional(),
  EMAIL_FROM_ADDRESS: z.string().email().optional(),
  EMAIL_REPLY_TO: z.string().email().optional(),
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Nodemailer + SMTP server | API-first providers (Resend, SendGrid) | 2020+ | Better deliverability, no server management |
| HTML email templates | React Email or plain text | 2023+ | Developer-friendly, consistent rendering |
| nodemailer-express-handlebars | String template functions or React | 2023+ | Simpler for transactional |
| Amazon SES direct | Resend/Postmark abstraction | 2023+ | Better DX, reasonable pricing |

**Deprecated/outdated:**
- Building SMTP servers for transactional email - use API providers
- Complex template engines for plain text - string functions are sufficient
- Email-only notifications - modern apps use multi-channel (email + in-app + push)

## Email Trigger Matrix

Summary of when each email is sent:

| Email Type | Trigger | Integration Point | Existing Code |
|------------|---------|-------------------|---------------|
| Welcome | `checkout.session.completed` | `src/webhooks/stripe.ts` | Add after member creation |
| Claim Reminder 48h | Scheduler poll | New function in scheduler | New schedule check |
| Claim Reminder 7d | Scheduler poll | New function in scheduler | New schedule check |
| Claim Reminder 30d+ | Scheduler poll | New function in scheduler | New schedule check |
| Payment Failure | `invoice.payment_failed` | `src/billing/failure-handler.ts` | Add after DM |
| Payment Recovered | `invoice.paid` | `src/billing/recovery-handler.ts` | Add after role restore |
| Seat Invite | Team invite creation | `src/routes/team-invites.ts` | Add after invite created |

## Schema Updates Required

Repurpose or extend existing `sentBillingNotifications` field for claim reminders, or add dedicated field:

```prisma
model Member {
  // ... existing fields ...

  // Extend existing field for claim reminders
  // sentBillingNotifications already exists, can include 'claim_48h', 'claim_7d', etc.

  // OR add dedicated field
  sentEmailNotifications  String[]   @default([])  // Track all sent emails
}
```

## Environment Variables Required

```env
# Email Provider
EMAIL_PROVIDER=resend                                    # 'resend' or 'console'
RESEND_API_KEY=re_xxxxxxxxxxxxx                          # From resend.com dashboard
EMAIL_FROM_ADDRESS=The Revenue Council <noreply@yourdomain.com>
EMAIL_REPLY_TO=support@yourdomain.com                    # Must be monitored!
```

## Open Questions

Things that couldn't be fully resolved:

1. **Domain Setup for Resend**
   - What we know: Resend requires domain verification for custom from addresses
   - What's unclear: Which domain will be used? Is DNS accessible?
   - Recommendation: Start with Resend's sandbox domain for testing, add custom domain later

2. **Team Invite Email Address Collection**
   - What we know: Current invite flow is token-based, no email required
   - What's unclear: How to get invitee's email to send the invite
   - Recommendation: Add optional email field to invite creation. If provided, send email. If not, admin shares link manually.

3. **Email for Team Members on Billing Failure**
   - What we know: Team members get brief DM notification
   - What's unclear: Should they also get email? They may not have email on file.
   - Recommendation: Send email only to team owner (who has billing relationship), not team members

4. **Monthly Claim Reminder Cadence**
   - What we know: CONTEXT.md says "monthly thereafter" after 30 days
   - What's unclear: How many months? Forever?
   - Recommendation: Continue for 6 months (60d, 90d, 120d, 150d, 180d), then stop

## Sources

### Primary (HIGH confidence)
- [Resend API Documentation](https://resend.com/docs/api-reference/emails/send-email) - Send email API format
- [Resend Node.js SDK](https://resend.com/nodejs) - SDK installation and usage
- Existing codebase patterns (`src/billing/scheduler.ts`, `src/billing/notifications.ts`)
- CONTEXT.md - Phase requirements and decisions

### Secondary (MEDIUM confidence)
- [Transactional Email Services Comparison](https://knock.app/blog/the-top-transactional-email-services-for-developers) - Provider comparison
- [Resend vs SendGrid](https://forwardemail.net/en/blog/resend-vs-sendgrid-email-service-comparison) - Feature comparison

### Tertiary (LOW confidence)
- WebSearch results on email best practices - General guidance

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Resend is well-documented, SDK is straightforward
- Architecture: HIGH - Extends existing codebase patterns
- Pitfalls: MEDIUM - Based on general email sending experience
- Templates: HIGH - Plain text per CONTEXT.md, no complexity needed
- Scheduling: HIGH - Mirrors existing billing scheduler exactly

**Research date:** 2026-01-19
**Valid until:** 2026-02-19 (30 days - Resend API stable)
