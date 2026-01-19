import { Events, Message, MessageType, PartialMessage } from 'discord.js';
import { discordClient } from '../client.js';
import { env } from '../../config/env.js';
import { logger } from '../../index.js';
import { prisma } from '../../lib/prisma.js';

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
 * Currently a stub - role promotion logic in Plan 04-02.
 */
async function processIntroduction(message: Message): Promise<void> {
  logger.info(
    { discordId: message.author.id, length: message.content.length },
    'Introduction message detected'
  );

  // TODO: Role promotion logic in Plan 04-02
}
