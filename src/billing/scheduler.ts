import { prisma } from '../lib/prisma.js';
import { logger } from '../index.js';
import {
  moveToDebtorState,
  moveTeamToDebtorState,
  kickAfterDebtorExpiry,
  kickTeamAfterDebtorExpiry,
} from './debtor-state.js';
import {
  sendPaymentFailedDm,
  sendBillingReminderDm,
  sendFinalWarningDm,
} from './notifications.js';

// Polling interval: 5 minutes
const POLL_INTERVAL_MS = 5 * 60 * 1000;

// Notification schedule: offset in hours from paymentFailedAt
// 48 hours grace period, then 30 days in debtor state
const NOTIFICATION_SCHEDULE = [
  // Grace period notifications
  { offsetHours: 0, key: 'immediate' }, // Handled in failure-handler
  { offsetHours: 24, key: '24h_warning' },
  { offsetHours: 48, key: 'debtor_transition' },
  // Days in debtor state (offset from paymentFailedAt, so add 48 hours base)
  { offsetHours: 48 + 7 * 24, key: '7d_reminder', daysRemaining: 23 },
  { offsetHours: 48 + 10 * 24, key: '10d_reminder', daysRemaining: 20 },
  { offsetHours: 48 + 15 * 24, key: '15d_reminder', daysRemaining: 15 },
  { offsetHours: 48 + 20 * 24, key: '20d_reminder', daysRemaining: 10 },
  { offsetHours: 48 + 25 * 24, key: '25d_reminder', daysRemaining: 5 },
  // Final warnings (relative to 30-day kick = 48h grace + 30 days debtor)
  { offsetHours: 48 + 28 * 24, key: '48h_before_kick', hoursRemaining: 48 },
  { offsetHours: 48 + 29 * 24, key: '24h_before_kick', hoursRemaining: 24 },
  { offsetHours: 48 + 29.5 * 24, key: '12h_before_kick', hoursRemaining: 12 },
] as const;

/**
 * Process a single poll cycle for billing state management
 */
async function processBillingPoll(): Promise<{
  graceExpired: number;
  debtorExpired: number;
  notificationsSent: number;
}> {
  const now = new Date();
  let graceExpired = 0;
  let debtorExpired = 0;
  let notificationsSent = 0;

  // 1. Process grace period expirations for individual members
  const expiredGracePeriodMembers = await prisma.member.findMany({
    where: {
      gracePeriodEndsAt: { lte: now },
      isInDebtorState: false,
      paymentFailedAt: { not: null },
      teamId: null, // Individual members only (team handled separately)
    },
  });

  for (const member of expiredGracePeriodMembers) {
    try {
      await moveToDebtorState(member.id);
      graceExpired++;
    } catch (error) {
      logger.error({ memberId: member.id, error }, 'Failed to move member to Debtor state');
    }
  }

  // 2. Process grace period expirations for teams
  const expiredGracePeriodTeams = await prisma.team.findMany({
    where: {
      gracePeriodEndsAt: { lte: now },
      debtorStateEndsAt: null, // Not yet in debtor state
      paymentFailedAt: { not: null },
    },
  });

  for (const team of expiredGracePeriodTeams) {
    try {
      await moveTeamToDebtorState(team.id);
      graceExpired++;
    } catch (error) {
      logger.error({ teamId: team.id, error }, 'Failed to move team to Debtor state');
    }
  }

  // 3. Process debtor state expirations for individual members
  const expiredDebtorStateMembers = await prisma.member.findMany({
    where: {
      debtorStateEndsAt: { lte: now },
      isInDebtorState: true,
      teamId: null, // Individual members only
    },
  });

  for (const member of expiredDebtorStateMembers) {
    try {
      await kickAfterDebtorExpiry(member.id);
      debtorExpired++;
    } catch (error) {
      logger.error({ memberId: member.id, error }, 'Failed to kick member after Debtor expiry');
    }
  }

  // 4. Process debtor state expirations for teams
  const expiredDebtorStateTeams = await prisma.team.findMany({
    where: {
      debtorStateEndsAt: { lte: now },
      paymentFailedAt: { not: null },
    },
  });

  for (const team of expiredDebtorStateTeams) {
    try {
      await kickTeamAfterDebtorExpiry(team.id);
      debtorExpired++;
    } catch (error) {
      logger.error({ teamId: team.id, error }, 'Failed to kick team after Debtor expiry');
    }
  }

  // 5. Process notification cadence for all members in billing failure state
  const membersInFailure = await prisma.member.findMany({
    where: {
      paymentFailedAt: { not: null },
    },
  });

  for (const member of membersInFailure) {
    const failureTime = member.paymentFailedAt!.getTime();
    const elapsedHours = (now.getTime() - failureTime) / (1000 * 60 * 60);

    for (const notification of NOTIFICATION_SCHEDULE) {
      // Check if this notification should have been sent
      if (elapsedHours >= notification.offsetHours) {
        // Check if already sent
        if (!member.sentBillingNotifications.includes(notification.key)) {
          try {
            let sent = false;

            // Send appropriate notification based on key
            switch (notification.key) {
              case 'immediate':
                // Already handled in failure-handler, skip
                break;
              case '24h_warning':
                sent = await sendPaymentFailedDm(member.id, '24h_warning');
                break;
              case 'debtor_transition':
                // Debtor transition DM is sent in moveToDebtorState
                sent = true;
                break;
              case '7d_reminder':
              case '10d_reminder':
              case '15d_reminder':
              case '20d_reminder':
              case '25d_reminder':
                sent = await sendBillingReminderDm(
                  member.id,
                  (notification as { daysRemaining: number }).daysRemaining
                );
                break;
              case '48h_before_kick':
              case '24h_before_kick':
              case '12h_before_kick':
                sent = await sendFinalWarningDm(
                  member.id,
                  (notification as { hoursRemaining: number }).hoursRemaining
                );
                break;
            }

            // Mark notification as sent (regardless of DM success - user may have DMs disabled)
            if (notification.key !== 'immediate') {
              await prisma.member.update({
                where: { id: member.id },
                data: {
                  sentBillingNotifications: {
                    push: notification.key,
                  },
                },
              });

              if (sent) {
                notificationsSent++;
              }
            }
          } catch (error) {
            logger.error(
              { memberId: member.id, notificationKey: notification.key, error },
              'Failed to process billing notification'
            );
          }
        }
      }
    }
  }

  return { graceExpired, debtorExpired, notificationsSent };
}

/**
 * Start the billing scheduler
 * Polls every 5 minutes for:
 * - Grace period expirations (move to Debtor state)
 * - Debtor state expirations (kick from server)
 * - Notification cadence (send DMs at scheduled intervals)
 */
export function startBillingScheduler(): void {
  logger.info('Starting billing scheduler (5-minute poll interval)');

  // Run initial poll immediately
  processBillingPoll()
    .then(({ graceExpired, debtorExpired, notificationsSent }) => {
      logger.info(
        { graceExpired, debtorExpired, notificationsSent },
        'Initial billing poll complete'
      );
    })
    .catch((error) => {
      logger.error({ error }, 'Initial billing poll failed');
    });

  // Set up recurring poll
  setInterval(async () => {
    try {
      const { graceExpired, debtorExpired, notificationsSent } = await processBillingPoll();

      // Only log if something happened
      if (graceExpired > 0 || debtorExpired > 0 || notificationsSent > 0) {
        logger.info(
          { graceExpired, debtorExpired, notificationsSent },
          'Billing poll processed state transitions'
        );
      } else {
        logger.debug('Billing poll: no state transitions');
      }
    } catch (error) {
      logger.error({ error }, 'Billing poll failed');
      // Don't throw - scheduler should continue running
    }
  }, POLL_INTERVAL_MS);
}
