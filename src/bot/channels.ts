import {
  ChannelType,
  PermissionFlagsBits,
  TextChannel,
  type Guild,
} from 'discord.js';
import { logger } from '../index.js';

const BILLING_SUPPORT_CHANNEL_NAME = 'billing-support';

const BILLING_SUPPORT_PINNED_MESSAGE =
  'Hail, member of The Revenue Council!\n\n' +
  'Thy payment hath encountered difficulties. Fear not - this matter can be resolved.\n\n' +
  '**To restore thy standing:**\n' +
  '1. Visit thy Stripe billing portal to update payment details\n' +
  '2. Once payment succeeds, thy access shall be restored automatically\n\n' +
  'The Treasury awaits thy resolution.';

/**
 * Ensures the #billing-support channel exists with correct permissions.
 * Called on bot startup to have the channel ready for Debtors.
 *
 * Permissions:
 * - @everyone: Cannot view (hidden by default)
 * - Debtor role: Can view and read history, cannot send messages
 * - Bot: Can view, send, and manage messages (for pinning)
 */
export async function ensureBillingSupportChannel(guild: Guild): Promise<void> {
  // Check if channel already exists
  const existing = guild.channels.cache.find(
    (ch) =>
      ch.name === BILLING_SUPPORT_CHANNEL_NAME &&
      ch.type === ChannelType.GuildText
  ) as TextChannel | undefined;

  if (existing) {
    logger.info(
      { channelId: existing.id },
      'Billing support channel already exists'
    );
    return;
  }

  // Get Debtor role
  const debtorRole = guild.roles.cache.find((r) => r.name === 'Debtor');
  if (!debtorRole) {
    logger.error('Debtor role not found - cannot create billing support channel');
    return;
  }

  // Get bot user ID
  const botUserId = guild.client.user?.id;
  if (!botUserId) {
    logger.error('Bot user ID not available');
    return;
  }

  // Create channel with restricted permissions
  const channel = await guild.channels.create({
    name: BILLING_SUPPORT_CHANNEL_NAME,
    type: ChannelType.GuildText,
    topic: 'Billing support for members with payment issues',
    permissionOverwrites: [
      // Deny everyone by default (hide from non-debtors)
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      // Allow Debtor to view and read, but not send
      {
        id: debtorRole.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.ReadMessageHistory,
        ],
        deny: [PermissionFlagsBits.SendMessages],
      },
      // Allow bot full access for sending and pinning
      {
        id: botUserId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageMessages, // Required for pinning
        ],
      },
    ],
    reason: 'TRC Bot: Billing support channel for debtors',
  });

  logger.info({ channelId: channel.id }, 'Created #billing-support channel');

  // Send and pin the welcome/instructions message
  try {
    const message = await channel.send(BILLING_SUPPORT_PINNED_MESSAGE);
    await message.pin();
    logger.info('Pinned billing support instructions message');
  } catch (error) {
    logger.error({ error }, 'Failed to send/pin billing support message');
  }
}
