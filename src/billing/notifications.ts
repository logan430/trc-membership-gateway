import { discordClient } from '../bot/client.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../index.js';
import { env } from '../config/env.js';

/**
 * Send a payment failure DM to an individual member
 * @param memberId - Database member ID
 * @param type - 'immediate' for first failure, '24h_warning' for 24-hour warning
 */
export async function sendPaymentFailedDm(
  memberId: string,
  type: 'immediate' | '24h_warning'
): Promise<boolean> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
  });

  if (!member?.discordId) {
    logger.warn({ memberId }, 'Cannot send payment DM - no discordId');
    return false;
  }

  try {
    const discordUser = await discordClient.users.fetch(member.discordId);

    const message =
      type === 'immediate'
        ? `Hark! The Treasury reports a matter requiring thy attention.\n\n` +
          `A payment for thy membership hath encountered difficulties. ` +
          `Fear not - thou hast 48 hours to resolve this matter whilst retaining full access.\n\n` +
          `Visit thy Stripe billing portal to update thy payment details.\n\n` +
          `The Council values thy presence and awaits thy resolution.`
        : `A gentle reminder from The Treasury.\n\n` +
          `Thy payment matter remaineth unresolved. In 24 hours, thy access shall be restricted ` +
          `until payment is restored.\n\n` +
          `Visit thy Stripe billing portal to update thy payment details.\n\n` +
          `The Council hopes to see this matter resolved swiftly.`;

    await discordUser.send({ content: message });
    logger.info({ memberId, type }, 'Payment failure DM sent');
    return true;
  } catch (error) {
    // DMs can fail if user has DMs disabled - log but don't throw
    logger.warn({ memberId, type, error }, 'Failed to send payment failure DM');
    return false;
  }
}

/**
 * Send a team payment failure DM to a team member
 * @param memberId - Database member ID
 * @param isOwner - True if member is team owner (gets full details), false for brief notice
 */
export async function sendTeamPaymentFailedDm(
  memberId: string,
  isOwner: boolean
): Promise<boolean> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
  });

  if (!member?.discordId) {
    logger.warn({ memberId }, 'Cannot send team payment DM - no discordId');
    return false;
  }

  try {
    const discordUser = await discordClient.users.fetch(member.discordId);

    const message = isOwner
      ? // Owner gets full billing details (same as individual)
        `Hark! The Treasury reports a matter requiring thy attention.\n\n` +
        `A payment for thy organization's membership hath encountered difficulties. ` +
        `Fear not - thy team hath 48 hours to resolve this matter whilst retaining full access.\n\n` +
        `Visit thy Stripe billing portal to update thy payment details.\n\n` +
        `The Council values thy organization's presence and awaits thy resolution.`
      : // Team member gets brief notice only
        `Hail, member of The Revenue Council!\n\n` +
        `Thy organization hath encountered a billing matter. ` +
        `Please contact thy organization administrator for details.\n\n` +
        `Thy access may be affected if this matter is not resolved.`;

    await discordUser.send({ content: message });
    logger.info({ memberId, isOwner }, 'Team payment failure DM sent');
    return true;
  } catch (error) {
    // DMs can fail if user has DMs disabled - log but don't throw
    logger.warn({ memberId, isOwner, error }, 'Failed to send team payment failure DM');
    return false;
  }
}

/**
 * Send a billing reminder DM during Debtor state
 * @param memberId - Database member ID
 * @param daysRemaining - Days until kick (7, 10, 15, 20, 25)
 */
export async function sendBillingReminderDm(
  memberId: string,
  daysRemaining: number
): Promise<boolean> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
  });

  if (!member?.discordId) {
    logger.warn({ memberId }, 'Cannot send billing reminder DM - no discordId');
    return false;
  }

  try {
    const discordUser = await discordClient.users.fetch(member.discordId);

    const message =
      `A reminder from The Treasury.\n\n` +
      `Thy payment matter remaineth unresolved. Thou hast ${daysRemaining} days remaining ` +
      `before thy access to the guild shall end entirely.\n\n` +
      `Visit thy Stripe billing portal to resolve this matter.\n\n` +
      `The Council values thy membership.`;

    await discordUser.send({ content: message });
    logger.info({ memberId, daysRemaining }, 'Billing reminder DM sent');
    return true;
  } catch (error) {
    logger.warn({ memberId, daysRemaining, error }, 'Failed to send billing reminder DM');
    return false;
  }
}

/**
 * Send a final warning DM before kick
 * @param memberId - Database member ID
 * @param hoursRemaining - Hours until kick (48, 24, 12)
 */
export async function sendFinalWarningDm(
  memberId: string,
  hoursRemaining: number
): Promise<boolean> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
  });

  if (!member?.discordId) {
    logger.warn({ memberId }, 'Cannot send final warning DM - no discordId');
    return false;
  }

  try {
    const discordUser = await discordClient.users.fetch(member.discordId);

    const message =
      `URGENT: Final Warning from The Treasury.\n\n` +
      `Thy payment matter must be resolved within ${hoursRemaining} hours, ` +
      `or thy access to The Revenue Council shall end.\n\n` +
      `Visit thy Stripe billing portal immediately to update thy payment details.\n\n` +
      `This is thy final notice.`;

    await discordUser.send({ content: message });
    logger.info({ memberId, hoursRemaining }, 'Final warning DM sent');
    return true;
  } catch (error) {
    logger.warn({ memberId, hoursRemaining, error }, 'Failed to send final warning DM');
    return false;
  }
}

/**
 * Send a kick notification DM when access ends
 * @param memberId - Database member ID
 */
export async function sendKickNotificationDm(memberId: string): Promise<boolean> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
  });

  if (!member?.discordId) {
    logger.warn({ memberId }, 'Cannot send kick notification DM - no discordId');
    return false;
  }

  try {
    const discordUser = await discordClient.users.fetch(member.discordId);

    const message =
      `Thy time with The Revenue Council hath come to an end.\n\n` +
      `Due to unresolved billing matters, thy access hath been revoked.\n\n` +
      `Should thy circumstances change, The Gatekeeper awaits: ${env.APP_URL}\n\n` +
      `Fare thee well.`;

    await discordUser.send({ content: message });
    logger.info({ memberId }, 'Kick notification DM sent');
    return true;
  } catch (error) {
    logger.warn({ memberId, error }, 'Failed to send kick notification DM');
    return false;
  }
}

/**
 * Send a grace period recovery DM when payment is recovered during grace period
 * @param memberId - Database member ID
 */
export async function sendGracePeriodRecoveryDm(memberId: string): Promise<boolean> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
  });

  if (!member?.discordId) {
    logger.warn({ memberId }, 'Cannot send grace period recovery DM - no discordId');
    return false;
  }

  try {
    const discordUser = await discordClient.users.fetch(member.discordId);

    const message =
      `Huzzah! The Treasury brings glad tidings!\n\n` +
      `Thy payment hath been received and thy standing with The Revenue Council remaineth intact.\n\n` +
      `We thank thee for thy swift attention to this matter.\n\n` +
      `The Council celebrates thy continued membership!`;

    await discordUser.send({ content: message });
    logger.info({ memberId }, 'Grace period recovery DM sent');
    return true;
  } catch (error) {
    logger.warn({ memberId, error }, 'Failed to send grace period recovery DM');
    return false;
  }
}

/**
 * Send a Debtor state recovery DM when payment is recovered and role is restored
 * @param memberId - Database member ID
 * @param restoredRole - The role that was restored (Knight or Lord)
 */
export async function sendDebtorRecoveryDm(
  memberId: string,
  restoredRole: string
): Promise<boolean> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
  });

  if (!member?.discordId) {
    logger.warn({ memberId }, 'Cannot send Debtor recovery DM - no discordId');
    return false;
  }

  try {
    const discordUser = await discordClient.users.fetch(member.discordId);

    const message =
      `Welcome back to The Revenue Council!\n\n` +
      `Thy payment hath been received and thy full access is now restored.\n\n` +
      `Thou hast been restored to the rank of ${restoredRole}.\n\n` +
      `The Council celebrates thy return! May thy continued membership bring prosperity.`;

    await discordUser.send({ content: message });
    logger.info({ memberId, restoredRole }, 'Debtor recovery DM sent');
    return true;
  } catch (error) {
    logger.warn({ memberId, restoredRole, error }, 'Failed to send Debtor recovery DM');
    return false;
  }
}

/**
 * Send a team recovery DM when team payment is recovered
 * @param memberId - Database member ID
 * @param isOwner - True if member is team owner (gets full details)
 * @param restoredRole - The role that was restored (optional, for owners in Debtor state)
 */
export async function sendTeamRecoveryDm(
  memberId: string,
  isOwner: boolean,
  restoredRole?: string
): Promise<boolean> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
  });

  if (!member?.discordId) {
    logger.warn({ memberId }, 'Cannot send team recovery DM - no discordId');
    return false;
  }

  try {
    const discordUser = await discordClient.users.fetch(member.discordId);

    const message = isOwner
      ? // Owner gets full message with role restoration
        `Welcome back to The Revenue Council!\n\n` +
        `Thy payment hath been received and thy full access is now restored.\n\n` +
        (restoredRole ? `Thou hast been restored to the rank of ${restoredRole}.\n\n` : '') +
        `Thy team hath been restored.\n\n` +
        `The Council celebrates thy return! May thy continued membership bring prosperity.`
      : // Team member gets brief notice
        `Huzzah! Thy organization's payment matter hath been resolved.\n\n` +
        `Thy access to The Revenue Council is fully restored.\n\n` +
        `The Council welcomes thee back!`;

    await discordUser.send({ content: message });
    logger.info({ memberId, isOwner }, 'Team recovery DM sent');
    return true;
  } catch (error) {
    logger.warn({ memberId, isOwner, error }, 'Failed to send team recovery DM');
    return false;
  }
}
