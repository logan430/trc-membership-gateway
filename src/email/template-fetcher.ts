/**
 * Email template fetcher with database-first lookup and hardcoded fallback
 * Single source of truth for default template content and variable definitions
 */
import { prisma } from '../lib/prisma.js';

/**
 * Default email templates - single source of truth for default content
 * Templates use {{variableName}} syntax for variable substitution
 */
export const DEFAULT_TEMPLATES = [
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
];

/**
 * Known variables per template for validation
 */
export const TEMPLATE_VARIABLES: Record<string, string[]> = {
  welcome: ['claimUrl'],
  claim_reminder: ['claimUrl'],
  claim_reminder_cheeky: ['claimUrl'],
  payment_failure: ['gracePeriodHours', 'portalUrl'],
  payment_recovered: [],
  payment_recovered_debtor: [],
  seat_invite: ['teamName', 'claimUrl', 'seatTier'],
  reconciliation_report: ['issuesFound', 'fixStatus', 'summaryText', 'runId'],
};

/**
 * Substitute variables in template content
 * Replaces {{variableName}} with corresponding value
 */
function substituteVariables(
  content: string,
  variables: Record<string, string>
): string {
  let result = content;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value);
  }
  return result;
}

/**
 * Get email template with database-first lookup and hardcoded fallback
 * @param name - Template name (e.g., 'welcome', 'claim_reminder')
 * @param variables - Key-value pairs for variable substitution
 * @returns { subject, text } for use with emailProvider.send()
 * @throws Error if template not found in database or defaults
 */
export async function getTemplate(
  name: string,
  variables: Record<string, string>
): Promise<{ subject: string; text: string }> {
  // Try database first
  const dbTemplate = await prisma.emailTemplate.findUnique({
    where: { name },
  });

  if (dbTemplate) {
    return {
      subject: substituteVariables(dbTemplate.subject, variables),
      text: substituteVariables(dbTemplate.body, variables),
    };
  }

  // Fallback to hardcoded defaults
  const defaultTemplate = DEFAULT_TEMPLATES.find((t) => t.name === name);

  if (defaultTemplate) {
    return {
      subject: substituteVariables(defaultTemplate.subject, variables),
      text: substituteVariables(defaultTemplate.body, variables),
    };
  }

  throw new Error(`Template '${name}' not found`);
}

/**
 * Validate variables in template content
 * Checks for unknown variables that may be typos
 * @param templateName - Name of the template to validate against
 * @param content - Template content to check for variables
 * @returns { valid, unknownVariables } - valid is true if no unknown variables
 */
export function validateVariables(
  templateName: string,
  content: string
): { valid: boolean; unknownVariables: string[] } {
  // Extract all {{variableName}} from content
  const variableRegex = /\{\{(\w+)\}\}/g;
  const foundVariables: string[] = [];
  let match;

  while ((match = variableRegex.exec(content)) !== null) {
    foundVariables.push(match[1]);
  }

  // Get known variables for this template
  const knownVariables = TEMPLATE_VARIABLES[templateName] || [];
  const knownSet = new Set(knownVariables);

  // Find unknown variables
  const unknownVariables = foundVariables.filter((v) => !knownSet.has(v));
  // Dedupe unknown variables
  const uniqueUnknown = [...new Set(unknownVariables)];

  return {
    valid: uniqueUnknown.length === 0,
    unknownVariables: uniqueUnknown,
  };
}
