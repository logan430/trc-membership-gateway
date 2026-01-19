import { Client, GatewayIntentBits, Events, ActivityType } from 'discord.js';
import { env } from '../config/env.js';
import { logger } from '../index.js';
import { syncRoles } from './roles.js';
import { setupIntroductionHandlers } from './events/introduction.js';

// Create Discord client with required intents
// GuildMembers and MessageContent are privileged intents - must be enabled in Developer Portal
export const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // Privileged - for member.fetch() and role ops
    GatewayIntentBits.GuildMessages, // For messageCreate events
    GatewayIntentBits.MessageContent, // Privileged - for reading message content
  ],
});

// Handle ClientReady event
discordClient.on(Events.ClientReady, async (readyClient) => {
  logger.info({ tag: readyClient.user.tag }, 'Bot logged in');

  // Get configured guild
  const guild = readyClient.guilds.cache.get(env.DISCORD_GUILD_ID);
  if (!guild) {
    logger.error(
      { guildId: env.DISCORD_GUILD_ID },
      'Bot is not in configured guild'
    );
    return;
  }

  // Sync roles - ensure all managed roles exist
  await syncRoles(guild);

  // Set up introduction message handlers
  setupIntroductionHandlers();

  // Set presence per RESEARCH.md recommendation
  readyClient.user.setPresence({
    activities: [{ name: 'Managing memberships', type: ActivityType.Custom }],
    status: 'online',
  });

  logger.info('Bot startup complete');
});

// Handle errors
discordClient.on(Events.Error, (error) => {
  logger.error({ error }, 'Discord client error');
});

/**
 * Start the Discord bot
 * Call this after HTTP server is ready
 */
export async function startBot(): Promise<void> {
  logger.info('Starting Discord bot...');
  await discordClient.login(env.DISCORD_BOT_TOKEN);
}
