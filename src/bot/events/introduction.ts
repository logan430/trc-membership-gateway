import { Events, Message, MessageType, PartialMessage, User, GuildMember } from 'discord.js';
import type { Member } from '@prisma/client';
import { discordClient } from '../client.js';
import { env } from '../../config/env.js';
import { logger } from '../../index.js';
import { prisma } from '../../lib/prisma.js';
import { ROLE_CONFIG } from '../../config/discord.js';
import { swapRoleAsync } from '../../lib/role-assignment.js';

/** Minimum character count for a valid introduction */
export const MIN_INTRO_LENGTH = 100;

/**
 * Set up message event handlers for introduction detection.
 * Listens for both new messages and edits in #introductions channel.
 */
export function setupIntroductionHandlers(): void {
  discordClient.on(Events.MessageCreate, handleMessage);
  discordClient.on(Events.MessageUpdate, handleMessageUpdate);
  logger.info('Introduction handlers registered');
}

/**
 * Check if a message should be processed for introduction detection.
 * Filters out bots, wrong channels, and reply messages.
 */
function shouldProcess(message: Message): boolean {
  // Ignore bot messages
  if (message.author.bot) return false;

  // Only process messages in #introductions
  if (message.channel.id !== env.DISCORD_INTRODUCTIONS_CHANNEL_ID) return false;

  // Per CONTEXT.md: "Top-level messages only - replies to others don't count"
  if (message.type === MessageType.Reply) return false;

  return true;
}

/**
 * Handle new messages in channels.
 */
async function handleMessage(message: Message): Promise<void> {
  if (!shouldProcess(message)) return;
  await processIntroduction(message);
}

/**
 * Handle edited messages.
 * Per CONTEXT.md: "Message edits count - if they edit to meet length, promote them"
 */
async function handleMessageUpdate(
  _oldMessage: Message | PartialMessage,
  newMessage: Message | PartialMessage
): Promise<void> {
  // Fetch full message if partial (not cached)
  if (newMessage.partial) {
    try {
      newMessage = await newMessage.fetch();
    } catch {
      // Message deleted or unavailable
      return;
    }
  }

  if (!shouldProcess(newMessage as Message)) return;
  await processIntroduction(newMessage as Message);
}

/**
 * Process a potential introduction message.
 * Validates length and promotes user from Squire to Knight/Lord.
 */
async function processIntroduction(message: Message): Promise<void> {
  // Get text length (images don't count per CONTEXT.md)
  const textLength = message.content.length;

  // Lookup member by Discord ID
  const member = await prisma.member.findUnique({
    where: { discordId: message.author.id },
  });

  // Not in our system or already introduced - ignore
  if (!member || member.introCompleted) return;

  // Check if user has Squire role (paid but unintroduced)
  const guildMember = message.member;
  if (!guildMember) return;

  const hasSquireRole = guildMember.roles.cache.some(
    (r) => r.name === ROLE_CONFIG.SQUIRE.name
  );
  if (!hasSquireRole) return;

  // Validate length
  if (textLength < MIN_INTRO_LENGTH) {
    await sendGuidanceDM(member, message.author);
    return;
  }

  // Valid intro - react and promote
  try {
    await message.react('\u{1F389}');
  } catch (err) {
    logger.debug({ error: err }, 'Could not add reaction');
  }

  await promoteAfterIntro(member, guildMember, message.id);
}

/**
 * Send guidance DM for too-short introduction.
 * Rate-limited to once per 24 hours.
 */
async function sendGuidanceDM(member: Member, user: User): Promise<void> {
  // Check rate limit: if lastGuidanceDmAt within 24 hours, skip
  if (member.lastGuidanceDmAt) {
    const hoursSince = (Date.now() - member.lastGuidanceDmAt.getTime()) / (1000 * 60 * 60);
    if (hoursSince < 24) {
      logger.debug(
        { discordId: user.id, hoursSince },
        'Guidance DM rate limited'
      );
      return;
    }
  }

  // Send guidance DM
  try {
    await user.send({
      content:
        `Greetings, traveler!\n\n` +
        `The Revenue Council requires a proper introduction before you may enter our halls.\n\n` +
        `We wish to know what draws you to our guild - your background, your interests, and what you hope to find here.\n\n` +
        `Your introduction must be at least 100 characters. Take your time to craft something meaningful!`,
    });

    // Update rate limit timestamp
    await prisma.member.update({
      where: { id: member.id },
      data: { lastGuidanceDmAt: new Date() },
    });

    logger.debug({ discordId: user.id }, 'Guidance DM sent');
  } catch (err) {
    // User may have DMs disabled
    logger.debug({ error: err, discordId: user.id }, 'Could not send guidance DM');
  }
}

/**
 * Promote member after valid introduction.
 * Swaps Squire role for Knight/Lord based on seat tier.
 */
async function promoteAfterIntro(
  member: Member,
  guildMember: GuildMember,
  messageId: string
): Promise<void> {
  // Determine target role based on seatTier
  // OWNER -> Lord, INDIVIDUAL/TEAM_MEMBER -> Knight
  const targetRole =
    member.seatTier === 'OWNER'
      ? ROLE_CONFIG.LORD.name
      : ROLE_CONFIG.KNIGHT.name;

  // Swap roles (fire-and-forget with retry)
  swapRoleAsync(guildMember.id, ROLE_CONFIG.SQUIRE.name, targetRole);

  // Update database
  await prisma.member.update({
    where: { id: member.id },
    data: {
      introCompleted: true,
      introCompletedAt: new Date(),
      introMessageId: messageId,
    },
  });

  // Send welcome DM
  await sendWelcomeDM(guildMember.user, targetRole);

  logger.info(
    { memberId: member.id, discordId: guildMember.id, targetRole },
    'Member promoted after introduction'
  );
}

/**
 * Send welcome DM after promotion.
 * Medieval-themed welcome message.
 */
async function sendWelcomeDM(user: User, roleName: string): Promise<void> {
  const title = roleName === ROLE_CONFIG.LORD.name ? 'Lord' : 'Knight';

  try {
    await user.send({
      content:
        `Hail, ${title} ${user.displayName}!\n\n` +
        `You have been formally admitted to The Revenue Council guild. The halls of knowledge and fellowship now open before you.\n\n` +
        `Please review our community guidelines: ${env.APP_URL}/guidelines\n\n` +
        `Welcome to the Council!`,
    });
    logger.debug({ discordId: user.id }, 'Welcome DM sent');
  } catch (err) {
    // User may have DMs disabled
    logger.debug({ error: err, discordId: user.id }, 'Could not send welcome DM');
  }
}
