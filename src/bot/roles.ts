import { Guild, TextChannel } from 'discord.js';
import { discordClient } from './client.js';
import { ROLE_CONFIG, MANAGED_ROLES } from '../config/discord.js';
import { env } from '../config/env.js';
import { logger } from '../index.js';

/**
 * Alert admin about role operation failures
 * Best-effort: tries admin channel first, then guild owner DM
 */
async function alertAdmin(message: string): Promise<void> {
  // Always log the alert
  logger.warn({ alert: message }, 'Admin alert');

  const guild = discordClient.guilds.cache.get(env.DISCORD_GUILD_ID);
  if (!guild) return;

  // Try admin channel first if configured
  if (env.DISCORD_ADMIN_CHANNEL_ID) {
    try {
      const channel = await discordClient.channels.fetch(
        env.DISCORD_ADMIN_CHANNEL_ID
      );
      if (channel?.isTextBased() && 'send' in channel) {
        await (channel as TextChannel).send(`**[TRC Bot Alert]** ${message}`);
        return;
      }
    } catch (error) {
      logger.debug({ error }, 'Failed to send to admin channel');
    }
  }

  // Fall back to guild owner DM
  try {
    const owner = await guild.fetchOwner();
    await owner.send(`**[TRC Bot Alert]** ${message}`);
  } catch (error) {
    logger.debug({ error }, 'Failed to DM guild owner');
    // Best-effort - don't throw
  }
}

/**
 * Sync roles on bot startup
 * Creates any missing managed roles
 */
export async function syncRoles(guild: Guild): Promise<void> {
  logger.info('Syncing roles...');

  for (const [key, config] of Object.entries(ROLE_CONFIG)) {
    // Check if role already exists
    const existingRole = guild.roles.cache.find((r) => r.name === config.name);
    if (existingRole) {
      logger.debug({ role: config.name }, 'Role already exists');
      continue;
    }

    // Create missing role
    try {
      const newRole = await guild.roles.create({
        name: config.name,
        color: config.color,
        reason: `TRC Bot: ${config.description}`,
      });
      logger.info({ role: newRole.name, id: newRole.id }, 'Created role');
    } catch (error) {
      logger.error({ error, role: config.name }, 'Failed to create role');
      await alertAdmin(`Failed to create role: ${config.name}`);
    }
  }

  logger.info('Role sync complete');
}

/**
 * Add a role to a Discord member
 * @param discordId - Discord user ID
 * @param roleName - Name of the role to add
 * @returns true if successful, false otherwise
 */
export async function addRoleToMember(
  discordId: string,
  roleName: string
): Promise<boolean> {
  const guild = discordClient.guilds.cache.get(env.DISCORD_GUILD_ID);
  if (!guild) {
    logger.error('Guild not found in cache');
    return false;
  }

  try {
    // Fetch member (may not be cached)
    const member = await guild.members.fetch(discordId);

    // Find role by name
    const role = guild.roles.cache.find((r) => r.name === roleName);
    if (!role) {
      logger.error({ roleName }, 'Role not found');
      await alertAdmin(`Role not found: ${roleName}`);
      return false;
    }

    // Add role to member
    await member.roles.add(role, 'TRC membership role assignment');
    logger.info(
      { discordId, role: roleName },
      'Added role to member'
    );
    return true;
  } catch (error) {
    logger.error({ error, discordId, roleName }, 'Failed to add role to member');
    await alertAdmin(
      `Failed to add role "${roleName}" to member ${discordId}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return false;
  }
}

/**
 * Remove a role from a Discord member
 * @param discordId - Discord user ID
 * @param roleName - Name of the role to remove
 * @returns true if successful, false otherwise
 */
export async function removeRoleFromMember(
  discordId: string,
  roleName: string
): Promise<boolean> {
  const guild = discordClient.guilds.cache.get(env.DISCORD_GUILD_ID);
  if (!guild) {
    logger.error('Guild not found in cache');
    return false;
  }

  try {
    // Fetch member (may not be cached)
    const member = await guild.members.fetch(discordId);

    // Find role by name
    const role = guild.roles.cache.find((r) => r.name === roleName);
    if (!role) {
      logger.error({ roleName }, 'Role not found');
      await alertAdmin(`Role not found: ${roleName}`);
      return false;
    }

    // Remove role from member
    await member.roles.remove(role, 'TRC membership role removal');
    logger.info(
      { discordId, role: roleName },
      'Removed role from member'
    );
    return true;
  } catch (error) {
    logger.error(
      { error, discordId, roleName },
      'Failed to remove role from member'
    );
    await alertAdmin(
      `Failed to remove role "${roleName}" from member ${discordId}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return false;
  }
}

/**
 * Remove all managed roles from a Discord member
 * @param discordId - Discord user ID
 * @returns true if successful, false otherwise
 */
export async function removeAllManagedRoles(
  discordId: string
): Promise<boolean> {
  const guild = discordClient.guilds.cache.get(env.DISCORD_GUILD_ID);
  if (!guild) {
    logger.error('Guild not found in cache');
    return false;
  }

  try {
    // Fetch member (may not be cached)
    const member = await guild.members.fetch(discordId);

    // Filter member's roles to find managed roles
    const managedRoles = member.roles.cache.filter((r) =>
      (MANAGED_ROLES as readonly string[]).includes(r.name)
    );

    if (managedRoles.size === 0) {
      logger.debug({ discordId }, 'No managed roles to remove');
      return true;
    }

    // Remove all managed roles at once
    await member.roles.remove(managedRoles, 'Subscription ended');

    const roleNames = managedRoles.map((r) => r.name);
    logger.info(
      { discordId, roleNames },
      'Removed all managed roles from member'
    );
    return true;
  } catch (error) {
    logger.error(
      { error, discordId },
      'Failed to remove managed roles from member'
    );
    await alertAdmin(
      `Failed to remove managed roles from member ${discordId}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return false;
  }
}
