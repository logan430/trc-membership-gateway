import { TextChannel } from 'discord.js';
import { discordClient } from '../bot/client.js';
import { env } from '../config/env.js';
import { logger } from '../index.js';
import { ReconciliationResult, DriftIssue } from './types.js';
import { sendReconciliationReportEmail } from '../email/send.js';

/**
 * Group issues by type for summary
 */
function groupByType(issues: DriftIssue[]): Record<string, DriftIssue[]> {
  return issues.reduce((acc, issue) => {
    if (!acc[issue.type]) acc[issue.type] = [];
    acc[issue.type].push(issue);
    return acc;
  }, {} as Record<string, DriftIssue[]>);
}

/**
 * Format reconciliation summary for Discord/email
 */
function formatSummary(result: ReconciliationResult): string {
  const lines: string[] = [
    `**Issues Found:** ${result.issuesFound}`,
    `**Auto-Fix:** ${result.autoFixEnabled ? 'Enabled' : 'Disabled (report only)'}`,
  ];

  if (result.autoFixEnabled && result.issuesFixed > 0) {
    lines.push(`**Issues Fixed:** ${result.issuesFixed}`);
  }

  // Group by type
  const byType = groupByType(result.issues);
  for (const [type, typeIssues] of Object.entries(byType)) {
    lines.push(`\n**${type}:** ${typeIssues.length}`);
    // Show first 5 examples
    for (const issue of typeIssues.slice(0, 5)) {
      lines.push(`- ${issue.description}`);
    }
    if (typeIssues.length > 5) {
      lines.push(`- ... and ${typeIssues.length - 5} more`);
    }
  }

  lines.push(`\nRun ID: ${result.runId}`);

  return lines.join('\n');
}

/**
 * Notify admins via Discord channel and email when issues found
 * Per CONTEXT.md: Only notify when issues found, not "all clear"
 */
export async function notifyAdmins(result: ReconciliationResult): Promise<void> {
  // Skip if no issues
  if (result.issuesFound === 0) {
    logger.info('Reconciliation complete: no issues found');
    return;
  }

  const summary = formatSummary(result);

  // 1. Discord admin channel notification
  if (env.DISCORD_ADMIN_CHANNEL_ID) {
    try {
      const channel = await discordClient.channels.fetch(env.DISCORD_ADMIN_CHANNEL_ID);
      if (channel?.isTextBased()) {
        await (channel as TextChannel).send({
          content: `**[Reconciliation Alert]**\n\n${summary}`,
        });
        logger.info('Reconciliation alert sent to Discord admin channel');
      }
    } catch (error) {
      logger.error({ error }, 'Failed to send reconciliation alert to Discord');
    }
  }

  // 2. Email notification to admin
  if (env.ADMIN_EMAIL) {
    try {
      await sendReconciliationReportEmail(env.ADMIN_EMAIL, result);
      logger.info({ email: env.ADMIN_EMAIL }, 'Reconciliation report email sent');
    } catch (error) {
      logger.error({ error }, 'Failed to send reconciliation report email');
    }
  }
}
