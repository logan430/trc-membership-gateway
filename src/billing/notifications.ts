import { discordClient } from '../bot/client.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../index.js';

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
