/**
 * Churn Digest Email Job
 * ANALYTICS-07: Weekly email digest of at-risk members
 *
 * Runs weekly on Monday at 09:00 UTC
 * Sends email to configured admin addresses with at-risk member summary
 */

import { getAtRiskMembers } from '../analytics/churn-prediction.js';
import { emailProvider } from '../email/send.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../index.js';

// Threshold for high-risk (included prominently in digest)
const HIGH_RISK_THRESHOLD = 60;
const MEDIUM_RISK_THRESHOLD = 30;

interface DigestStats {
  totalAtRisk: number;
  highRisk: number;
  mediumRisk: number;
  emailsSent: number;
  errors: number;
}

/**
 * Get admin email addresses to receive digest
 * Uses admins with SUPER_ADMIN role
 */
async function getDigestRecipients(): Promise<string[]> {
  const admins = await prisma.admin.findMany({
    where: { role: 'SUPER_ADMIN' },
    select: { email: true },
  });
  return admins.map((a) => a.email);
}

/**
 * Build email content for churn digest
 */
function buildDigestEmail(atRiskMembers: Awaited<ReturnType<typeof getAtRiskMembers>>): { subject: string; text: string } {
  const highRisk = atRiskMembers.filter((m) => m.score >= HIGH_RISK_THRESHOLD);
  const mediumRisk = atRiskMembers.filter((m) => m.score >= MEDIUM_RISK_THRESHOLD && m.score < HIGH_RISK_THRESHOLD);

  const subject = `[TRC] Weekly Churn Alert: ${highRisk.length} high-risk, ${mediumRisk.length} medium-risk members`;

  let text = `Weekly Churn Risk Digest\n`;
  text += `========================\n\n`;
  text += `Summary:\n`;
  text += `- High Risk (60+): ${highRisk.length} members\n`;
  text += `- Medium Risk (30-59): ${mediumRisk.length} members\n`;
  text += `- Total At-Risk: ${atRiskMembers.length} members\n\n`;

  if (highRisk.length > 0) {
    text += `HIGH RISK MEMBERS\n`;
    text += `-----------------\n`;
    for (const member of highRisk.slice(0, 10)) {
      text += `\n${member.email || member.discordUsername || member.memberId}\n`;
      text += `  Score: ${member.score}/100\n`;
      text += `  Status: ${member.subscriptionStatus}\n`;
      text += `  Last Active: ${member.lastActiveAt ? member.lastActiveAt.toISOString().split('T')[0] : 'Never'}\n`;
      text += `  Factors:\n`;
      for (const factor of member.factors) {
        text += `    - ${factor.description} (+${factor.points})\n`;
      }
    }
    if (highRisk.length > 10) {
      text += `\n... and ${highRisk.length - 10} more high-risk members\n`;
    }
  }

  if (mediumRisk.length > 0) {
    text += `\nMEDIUM RISK MEMBERS\n`;
    text += `-------------------\n`;
    for (const member of mediumRisk.slice(0, 5)) {
      text += `\n${member.email || member.discordUsername || member.memberId}\n`;
      text += `  Score: ${member.score}/100 | Last Active: ${member.lastActiveAt ? member.lastActiveAt.toISOString().split('T')[0] : 'Never'}\n`;
    }
    if (mediumRisk.length > 5) {
      text += `\n... and ${mediumRisk.length - 5} more medium-risk members\n`;
    }
  }

  text += `\n\nView full details in the Admin Analytics Dashboard:\n`;
  text += `${process.env.APP_URL || 'https://app.therevcouncil.com'}/admin/analytics\n`;

  return { subject, text };
}

/**
 * Send weekly churn digest to all admin recipients
 */
export async function sendChurnDigest(): Promise<DigestStats> {
  const stats: DigestStats = {
    totalAtRisk: 0,
    highRisk: 0,
    mediumRisk: 0,
    emailsSent: 0,
    errors: 0,
  };

  try {
    // Get at-risk members
    const atRiskMembers = await getAtRiskMembers(MEDIUM_RISK_THRESHOLD, 100);
    stats.totalAtRisk = atRiskMembers.length;
    stats.highRisk = atRiskMembers.filter((m) => m.score >= HIGH_RISK_THRESHOLD).length;
    stats.mediumRisk = atRiskMembers.filter((m) => m.score >= MEDIUM_RISK_THRESHOLD && m.score < HIGH_RISK_THRESHOLD).length;

    // Skip if no at-risk members
    if (atRiskMembers.length === 0) {
      logger.info('Churn digest: No at-risk members, skipping email');
      return stats;
    }

    // Get recipients
    const recipients = await getDigestRecipients();
    if (recipients.length === 0) {
      logger.warn('Churn digest: No admin recipients configured');
      return stats;
    }

    // Build and send email
    const { subject, text } = buildDigestEmail(atRiskMembers);

    for (const email of recipients) {
      try {
        await emailProvider.send({ to: email, subject, text });
        stats.emailsSent++;
        logger.info({ email }, 'Churn digest email sent');
      } catch (error) {
        stats.errors++;
        logger.error({ email, error }, 'Failed to send churn digest email');
      }
    }
  } catch (error) {
    stats.errors++;
    logger.error({ error }, 'Churn digest job failed');
    throw error;
  }

  return stats;
}
