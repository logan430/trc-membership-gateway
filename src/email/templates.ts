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
