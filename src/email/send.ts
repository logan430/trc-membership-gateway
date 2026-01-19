import { createEmailProvider, type EmailResult } from './provider.js';
import {
  welcomeEmailTemplate,
  claimReminderEmailTemplate,
  paymentFailureEmailTemplate,
  paymentRecoveredEmailTemplate,
  seatInviteEmailTemplate,
  reconciliationReportEmailTemplate,
} from './templates.js';
import type { ReconciliationResult } from '../reconciliation/types.js';
import { logger } from '../index.js';

/**
 * Singleton email provider instance
 * Created once at module load, uses the configured provider (console or resend)
 */
export const emailProvider = createEmailProvider();

/**
 * Test email connection by sending a test message
 * For manual testing only - not wired to any route
 */
export async function testEmailConnection(): Promise<EmailResult> {
  return emailProvider.send({
    to: 'test@example.com',
    subject: 'Email System Test',
    text: 'If you receive this, the email system is working.',
  });
}

/**
 * Send welcome email after successful checkout
 * Includes claim URL for Discord access
 */
export async function sendWelcomeEmail(
  email: string,
  claimUrl: string
): Promise<EmailResult> {
  const { subject, text } = welcomeEmailTemplate({ claimUrl });

  const result = await emailProvider.send({
    to: email,
    subject,
    text,
  });

  logger.info({ email, success: result.success }, 'Welcome email sent');
  return result;
}

/**
 * Send claim reminder email for members who haven't claimed Discord access
 * Tone varies based on daysSincePurchase (cheeky at 30+ days)
 */
export async function sendClaimReminderEmail(
  email: string,
  claimUrl: string,
  daysSincePurchase: number
): Promise<EmailResult> {
  const { subject, text } = claimReminderEmailTemplate({
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

/**
 * Send payment failure email when invoice.payment_failed fires
 * Includes portal URL and grace period timeline
 */
export async function sendPaymentFailureEmail(
  email: string,
  portalUrl: string,
  gracePeriodHours = 48
): Promise<EmailResult> {
  const { subject, text } = paymentFailureEmailTemplate({
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

/**
 * Send payment recovered email when invoice.paid fires after failure
 * Message varies based on whether member was in Debtor state
 */
export async function sendPaymentRecoveredEmail(
  email: string,
  wasInDebtorState: boolean
): Promise<EmailResult> {
  const { subject, text } = paymentRecoveredEmailTemplate({
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

/**
 * Send seat invite email to a prospective team member
 * Provides full context about The Revenue Council for recipients who may not know it
 */
export async function sendSeatInviteEmail(
  email: string,
  teamName: string,
  seatTier: 'OWNER' | 'TEAM_MEMBER',
  claimUrl: string
): Promise<EmailResult> {
  const { subject, text } = seatInviteEmailTemplate({ teamName, seatTier, claimUrl });

  const result = await emailProvider.send({
    to: email,
    subject,
    text,
  });

  logger.info(
    { email, teamName, seatTier, success: result.success, messageId: result.messageId },
    'Seat invite email sent'
  );

  return result;
}

/**
 * Send reconciliation report email to admin
 * Only sent when issues are found
 */
export async function sendReconciliationReportEmail(
  email: string,
  result: ReconciliationResult
): Promise<EmailResult> {
  // Build summary text for email
  const groupByType = (issues: typeof result.issues) =>
    issues.reduce((acc, issue) => {
      if (!acc[issue.type]) acc[issue.type] = [];
      acc[issue.type].push(issue);
      return acc;
    }, {} as Record<string, typeof result.issues>);

  const byType = groupByType(result.issues);
  const summaryLines: string[] = [];
  for (const [type, typeIssues] of Object.entries(byType)) {
    summaryLines.push(`${type}: ${typeIssues.length}`);
    for (const issue of typeIssues.slice(0, 3)) {
      summaryLines.push(`  - ${issue.description}`);
    }
    if (typeIssues.length > 3) {
      summaryLines.push(`  - ... and ${typeIssues.length - 3} more`);
    }
  }

  const { subject, text } = reconciliationReportEmailTemplate({
    runId: result.runId,
    issuesFound: result.issuesFound,
    issuesFixed: result.issuesFixed,
    autoFixEnabled: result.autoFixEnabled,
    summaryText: summaryLines.join('\n'),
  });

  const sendResult = await emailProvider.send({
    to: email,
    subject,
    text,
  });

  logger.info({ email, success: sendResult.success }, 'Reconciliation report email sent');
  return sendResult;
}
