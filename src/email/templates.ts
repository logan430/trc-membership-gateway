/**
 * Plain text email templates with medieval theme
 * All templates return { subject, text } for use with emailProvider.send()
 */

interface WelcomeEmailParams {
  claimUrl: string;
}

/**
 * Welcome email sent after successful checkout
 * Provides clear CTA to claim Discord access
 */
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

/**
 * Claim reminder email for members who haven't claimed Discord access
 * Tone varies based on days since purchase:
 * - <= 7d: Standard reminder
 * - > 30d: Cheeky tone expressing gratitude and desire to have them
 */
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

/**
 * Payment failure email template
 * Sent when invoice.payment_failed fires for renewal payments
 * Complements the Discord DM notification with portal URL and timeline
 */
export function paymentFailureEmailTemplate(params: PaymentFailureParams): { subject: string; text: string } {
  const { portalUrl, gracePeriodHours } = params;

  return {
    subject: 'Action needed: Payment issue with The Revenue Council',
    text: `Hark! A message from The Treasury.

A payment for thy membership with The Revenue Council hath encountered difficulties.

WHAT HAPPENS NEXT:
- Thou hast ${gracePeriodHours} hours to resolve this matter whilst retaining full access
- After the grace period: Thy access shall be restricted to #billing-support only
- After 30 days in restricted state: Thy membership shall end entirely

UPDATE THY PAYMENT:
${portalUrl}

COMMON CAUSES:
- Expired card on file
- Insufficient funds
- Bank declined the transaction

We urge thee to act swiftly. The Council values thy presence and wishes to see this matter resolved.

Faithfully,
The Treasury

---
If thou hast questions, reply to this message.
`,
  };
}

interface PaymentRecoveredParams {
  wasInDebtorState: boolean;
}

/**
 * Payment recovered email template
 * Sent when invoice.paid fires after a prior payment failure
 * Celebrates restoration if was in Debtor state, or thanks for swift resolution
 */
export function paymentRecoveredEmailTemplate(params: PaymentRecoveredParams): { subject: string; text: string } {
  const { wasInDebtorState } = params;

  if (wasInDebtorState) {
    // Full access restoration - was in Debtor state
    return {
      subject: 'Payment received - Welcome back!',
      text: `Huzzah! The Treasury brings most excellent tidings!

Thy payment hath been received and thy full access to The Revenue Council is now restored!

Thou art no longer restricted - all chambers of the guild are once again open to thee.

The Council celebrates thy return! May thy continued membership bring prosperity to all.

Welcome back, valued member.

Faithfully,
The Treasury

---
If thou hast questions, reply to this message.
`,
    };
  }

  // Swift resolution - recovered during grace period
  return {
    subject: 'Payment received - Welcome back!',
    text: `Huzzah! The Treasury brings glad tidings!

Thy payment hath been received and thy standing with The Revenue Council remaineth intact.

We thank thee for thy swift attention to this matter. Thy membership continues uninterrupted.

The Council celebrates thy continued membership!

Faithfully,
The Treasury

---
If thou hast questions, reply to this message.
`,
  };
}

interface SeatInviteParams {
  teamName: string;
  seatTier: 'OWNER' | 'TEAM_MEMBER';
  claimUrl: string;
}

/**
 * Seat invite email template
 * Sent when a team owner creates an invite and provides an email address
 * Provides full context about The Revenue Council for recipients who may not know it
 */
export function seatInviteEmailTemplate(params: SeatInviteParams): { subject: string; text: string } {
  const { teamName, seatTier, claimUrl } = params;

  const seatDescription = seatTier === 'OWNER'
    ? 'an Owner seat (with access to exclusive owner-only channels)'
    : 'a Team Member seat';

  return {
    subject: `You're invited to join ${teamName} at The Revenue Council`,
    text: `Hail!

Someone from ${teamName} hath invited thee to join The Revenue Council.

WHAT IS THE REVENUE COUNCIL?

The Revenue Council is a professional community of entrepreneurs united in purpose. We gather in our Discord halls for:
- Networking with fellow business owners
- Referrals and collaboration opportunities
- Peer support and knowledge sharing
- Exclusive resources and discussions

THY INVITATION

${teamName} hath granted thee ${seatDescription}. This means thy membership is covered through their company subscription.

TO CLAIM THY SEAT:

1. Visit: ${claimUrl}
2. Connect thy Discord account
3. Join our Discord server
4. Introduce thyself in #introductions

Note: Once introduced, thou shalt have full access to the guild.

Note: This invitation doth not expire. Claim it when thou art ready.

We look forward to welcoming thee to the guild!

The Gatekeeper
The Revenue Council

---
Questions about this invitation? Contact thy organization admin at ${teamName}.
Questions about The Revenue Council? Reply to this email.
`,
  };
}

interface ReconciliationReportParams {
  runId: string;
  issuesFound: number;
  issuesFixed: number;
  autoFixEnabled: boolean;
  summaryText: string;
}

/**
 * Reconciliation report email template
 * Sent to admin when drift issues are detected
 */
export function reconciliationReportEmailTemplate(params: ReconciliationReportParams): { subject: string; text: string } {
  const { runId, issuesFound, issuesFixed, autoFixEnabled, summaryText } = params;

  const subject = `[TRC Reconciliation] ${issuesFound} drift issue${issuesFound === 1 ? '' : 's'} detected`;

  const fixStatus = autoFixEnabled
    ? `Auto-fix is ENABLED. ${issuesFixed} issue${issuesFixed === 1 ? '' : 's'} were automatically corrected.`
    : `Auto-fix is DISABLED. Manual review required.`;

  const text = `
The Revenue Council - Reconciliation Report
============================================

${issuesFound} drift issue${issuesFound === 1 ? '' : 's'} detected between Stripe and Discord.

${fixStatus}

Summary:
${summaryText}

Run ID: ${runId}

---
This is an automated report from The Revenue Council membership system.
To enable automatic fixes, set RECONCILIATION_AUTO_FIX=true.
`.trim();

  return { subject, text };
}
