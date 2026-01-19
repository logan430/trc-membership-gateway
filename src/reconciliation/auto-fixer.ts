import pRetry from 'p-retry';
import { DriftIssue } from './types.js';
import { prisma } from '../lib/prisma.js';
import { addRoleToMember, removeRoleFromMember, removeAllManagedRoles } from '../bot/roles.js';
import { logger } from '../index.js';

// Rate limit protection: process in batches with delays
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 2000; // 2 seconds between batches (Discord: 10 role ops per 10s)

/**
 * Apply a single fix based on drift type
 * Returns true if fix was applied successfully
 */
async function applyFix(issue: DriftIssue): Promise<boolean> {
  if (!issue.discordId) return false;

  try {
    switch (issue.type) {
      case 'MISSING_ACCESS': {
        // Member should have a role but doesn't
        // Get expected role from database
        const member = await prisma.member.findUnique({
          where: { id: issue.memberId },
        });
        if (!member) return false;

        // Determine correct role
        let role = 'Squire'; // Default for unintroduced
        if (member.introCompleted) {
          role = member.seatTier === 'OWNER' || member.seatTier === 'INDIVIDUAL' ? 'Lord' : 'Knight';
        }
        if (member.isInDebtorState) {
          role = 'Debtor';
        }

        return await pRetry(() => addRoleToMember(issue.discordId!, role), {
          retries: 2,
          minTimeout: 1000,
        });
      }

      case 'UNAUTHORIZED_ACCESS': {
        // Member has role but shouldn't
        return await pRetry(() => removeAllManagedRoles(issue.discordId!), {
          retries: 2,
          minTimeout: 1000,
        });
      }

      case 'ROLE_MISMATCH': {
        // Member has wrong role - get correct one
        const member = await prisma.member.findUnique({
          where: { id: issue.memberId },
        });
        if (!member) return false;

        // Remove current managed roles, add correct one
        await pRetry(() => removeAllManagedRoles(issue.discordId!), {
          retries: 2,
          minTimeout: 1000,
        });

        let role = 'Knight';
        if (member.seatTier === 'OWNER' || member.seatTier === 'INDIVIDUAL') {
          role = 'Lord';
        }
        if (!member.introCompleted) {
          role = 'Squire';
        }
        if (member.isInDebtorState) {
          role = 'Debtor';
        }

        return await pRetry(() => addRoleToMember(issue.discordId!, role), {
          retries: 2,
          minTimeout: 1000,
        });
      }

      case 'DEBTOR_MISMATCH': {
        // Member in debtor state but missing Debtor role
        // Remove other roles, add Debtor
        await pRetry(() => removeAllManagedRoles(issue.discordId!), {
          retries: 2,
          minTimeout: 1000,
        });
        return await pRetry(() => addRoleToMember(issue.discordId!, 'Debtor'), {
          retries: 2,
          minTimeout: 1000,
        });
      }

      default:
        return false;
    }
  } catch (error) {
    logger.error({ issue, error }, 'Failed to apply fix');
    return false;
  }
}

/**
 * Apply fixes for all issues with rate limiting
 * Processes in batches to avoid Discord rate limits
 *
 * @param issues - Array of drift issues to fix
 * @returns Number of issues successfully fixed
 */
export async function applyFixes(issues: DriftIssue[]): Promise<number> {
  let fixed = 0;

  for (let i = 0; i < issues.length; i += BATCH_SIZE) {
    const batch = issues.slice(i, i + BATCH_SIZE);

    for (const issue of batch) {
      const success = await applyFix(issue);
      if (success) {
        fixed++;
        logger.info(
          { type: issue.type, memberId: issue.memberId, discordId: issue.discordId },
          'Applied reconciliation fix'
        );
      }
    }

    // Delay between batches (except after last batch)
    if (i + BATCH_SIZE < issues.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  return fixed;
}
