/**
 * Integration Verification Script
 *
 * Checks that all external integrations are properly configured:
 * - Supabase Database connectivity
 * - Stripe API access
 * - Discord Bot connectivity
 * - Supabase Storage access
 * - Email configuration
 *
 * Run: npx tsx scripts/verify-integrations.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// Color helpers for terminal output
const colors = {
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  dim: (text: string) => `\x1b[2m${text}\x1b[0m`,
};

const CHECK = colors.green('✓');
const CROSS = colors.red('✗');
const WARN = colors.yellow('⚠');

interface VerificationResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: string;
}

const results: VerificationResult[] = [];

function logResult(result: VerificationResult) {
  const icon = result.status === 'pass' ? CHECK : result.status === 'fail' ? CROSS : WARN;
  console.log(`  ${icon} ${result.name}: ${result.message}`);
  if (result.details) {
    console.log(colors.dim(`      ${result.details}`));
  }
  results.push(result);
}

async function verifyEnvironmentVariables() {
  console.log(colors.cyan('\n1. ENVIRONMENT VARIABLES'));
  console.log('   ' + '─'.repeat(50));

  // Required vars
  const required = [
    { key: 'DATABASE_URL', hint: 'Supabase pooler URL' },
    { key: 'JWT_SECRET', hint: 'At least 32 characters' },
    { key: 'STRIPE_SECRET_KEY', hint: 'Should start with sk_test_ or sk_live_' },
    { key: 'STRIPE_WEBHOOK_SECRET', hint: 'Should start with whsec_' },
    { key: 'DISCORD_CLIENT_ID', hint: 'Discord OAuth client ID' },
    { key: 'DISCORD_CLIENT_SECRET', hint: 'Discord OAuth client secret' },
    { key: 'DISCORD_BOT_TOKEN', hint: 'Discord bot token' },
    { key: 'DISCORD_GUILD_ID', hint: 'Discord server ID' },
  ];

  for (const { key, hint } of required) {
    const value = process.env[key];
    if (!value) {
      logResult({
        name: key,
        status: 'fail',
        message: 'Not set',
        details: hint,
      });
    } else {
      logResult({
        name: key,
        status: 'pass',
        message: 'Set',
      });
    }
  }

  // Optional but recommended
  const optional = [
    { key: 'DISCORD_INTRODUCTIONS_CHANNEL_ID', hint: 'For intro tracking' },
    { key: 'SUPABASE_URL', hint: 'For resource storage' },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', hint: 'For resource storage' },
  ];

  for (const { key, hint } of optional) {
    const value = process.env[key];
    if (!value) {
      logResult({
        name: key,
        status: 'warn',
        message: 'Not set (optional)',
        details: hint,
      });
    } else {
      logResult({
        name: key,
        status: 'pass',
        message: 'Set',
      });
    }
  }
}

async function verifyDatabaseConnection() {
  console.log(colors.cyan('\n2. DATABASE CONNECTION (Supabase)'));
  console.log('   ' + '─'.repeat(50));

  if (!process.env.DATABASE_URL) {
    logResult({
      name: 'Connection',
      status: 'fail',
      message: 'DATABASE_URL not set',
    });
    return;
  }

  try {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    // Test basic query
    const memberCount = await prisma.member.count();
    logResult({
      name: 'Connection',
      status: 'pass',
      message: 'Connected successfully',
    });

    logResult({
      name: 'Member Count',
      status: 'pass',
      message: `${memberCount} members in database`,
    });

    // Test admin table
    const adminCount = await prisma.admin.count();
    logResult({
      name: 'Admin Count',
      status: adminCount > 0 ? 'pass' : 'warn',
      message: adminCount > 0 ? `${adminCount} admins` : 'No admins - run seed script',
    });

    // Check point configs
    const pointConfigs = await prisma.pointConfig.count();
    logResult({
      name: 'Point Configs',
      status: pointConfigs > 0 ? 'pass' : 'warn',
      message: pointConfigs > 0 ? `${pointConfigs} configs` : 'No point configs - run seed script',
    });

    await prisma.$disconnect();
    await pool.end();
  } catch (error) {
    logResult({
      name: 'Connection',
      status: 'fail',
      message: 'Connection failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

async function verifyStripeConfiguration() {
  console.log(colors.cyan('\n3. STRIPE CONFIGURATION'));
  console.log('   ' + '─'.repeat(50));

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Check key format
  if (!stripeKey) {
    logResult({
      name: 'API Key',
      status: 'fail',
      message: 'STRIPE_SECRET_KEY not set',
    });
  } else if (stripeKey.startsWith('sk_test_')) {
    logResult({
      name: 'API Key',
      status: 'pass',
      message: 'Test mode key configured',
    });
  } else if (stripeKey.startsWith('sk_live_')) {
    logResult({
      name: 'API Key',
      status: 'warn',
      message: 'Live mode key configured',
      details: 'Make sure this is intentional for testing',
    });
  } else {
    logResult({
      name: 'API Key',
      status: 'fail',
      message: 'Invalid key format',
      details: 'Should start with sk_test_ or sk_live_',
    });
  }

  // Check webhook secret
  if (!webhookSecret) {
    logResult({
      name: 'Webhook Secret',
      status: 'fail',
      message: 'STRIPE_WEBHOOK_SECRET not set',
    });
  } else if (webhookSecret.startsWith('whsec_')) {
    logResult({
      name: 'Webhook Secret',
      status: 'pass',
      message: 'Webhook secret configured',
    });
  } else {
    logResult({
      name: 'Webhook Secret',
      status: 'fail',
      message: 'Invalid format',
      details: 'Should start with whsec_',
    });
  }

  // Check price IDs
  const priceIds = [
    { key: 'STRIPE_INDIVIDUAL_PRICE_ID', name: 'Individual Price' },
    { key: 'STRIPE_OWNER_SEAT_PRICE_ID', name: 'Owner Seat Price' },
    { key: 'STRIPE_TEAM_SEAT_PRICE_ID', name: 'Team Seat Price' },
  ];

  for (const { key, name } of priceIds) {
    const value = process.env[key];
    if (!value) {
      logResult({
        name,
        status: 'fail',
        message: 'Not set',
      });
    } else if (value.startsWith('price_')) {
      logResult({
        name,
        status: 'pass',
        message: 'Configured',
      });
    } else {
      logResult({
        name,
        status: 'fail',
        message: 'Invalid format',
        details: 'Should start with price_',
      });
    }
  }

  // Test Stripe API
  if (stripeKey) {
    try {
      const stripe = (await import('stripe')).default;
      const stripeClient = new stripe(stripeKey);
      const balance = await stripeClient.balance.retrieve();
      logResult({
        name: 'API Connection',
        status: 'pass',
        message: 'Connected to Stripe API',
      });
    } catch (error) {
      logResult({
        name: 'API Connection',
        status: 'fail',
        message: 'Failed to connect',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function verifyDiscordConfiguration() {
  console.log(colors.cyan('\n4. DISCORD CONFIGURATION'));
  console.log('   ' + '─'.repeat(50));

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  // OAuth config
  if (clientId && clientSecret) {
    logResult({
      name: 'OAuth Config',
      status: 'pass',
      message: 'Client ID and Secret configured',
    });
  } else {
    logResult({
      name: 'OAuth Config',
      status: 'fail',
      message: 'Missing OAuth credentials',
      details: !clientId ? 'DISCORD_CLIENT_ID not set' : 'DISCORD_CLIENT_SECRET not set',
    });
  }

  // Bot token
  if (!botToken) {
    logResult({
      name: 'Bot Token',
      status: 'fail',
      message: 'DISCORD_BOT_TOKEN not set',
    });
  } else {
    logResult({
      name: 'Bot Token',
      status: 'pass',
      message: 'Configured',
    });

    // Test bot connection
    try {
      const { Client, GatewayIntentBits } = await import('discord.js');
      const client = new Client({
        intents: [GatewayIntentBits.Guilds],
      });

      await Promise.race([
        new Promise<void>((resolve, reject) => {
          client.once('ready', () => {
            logResult({
              name: 'Bot Connection',
              status: 'pass',
              message: `Logged in as ${client.user?.tag}`,
            });
            client.destroy();
            resolve();
          });
          client.once('error', reject);
          client.login(botToken);
        }),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout (10s)')), 10000)
        ),
      ]);
    } catch (error) {
      logResult({
        name: 'Bot Connection',
        status: 'fail',
        message: 'Failed to connect',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Guild ID
  if (guildId) {
    logResult({
      name: 'Guild ID',
      status: 'pass',
      message: 'Configured',
    });
  } else {
    logResult({
      name: 'Guild ID',
      status: 'fail',
      message: 'DISCORD_GUILD_ID not set',
    });
  }

  // Channel IDs
  const introsChannel = process.env.DISCORD_INTRODUCTIONS_CHANNEL_ID;
  if (introsChannel) {
    logResult({
      name: 'Intros Channel',
      status: 'pass',
      message: 'Configured',
    });
  } else {
    logResult({
      name: 'Intros Channel',
      status: 'warn',
      message: 'Not set (intro tracking disabled)',
    });
  }
}

async function verifySupabaseStorage() {
  console.log(colors.cyan('\n5. SUPABASE STORAGE'));
  console.log('   ' + '─'.repeat(50));

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    logResult({
      name: 'Configuration',
      status: 'warn',
      message: 'Not configured',
      details: 'Resource library uploads will not work',
    });
    return;
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // List buckets
    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) {
      throw error;
    }

    logResult({
      name: 'Connection',
      status: 'pass',
      message: 'Connected to Supabase',
    });

    const resourcesBucket = buckets?.find((b) => b.name === 'resources');
    if (resourcesBucket) {
      logResult({
        name: 'Resources Bucket',
        status: 'pass',
        message: 'Exists',
      });
    } else {
      logResult({
        name: 'Resources Bucket',
        status: 'warn',
        message: 'Not found',
        details: 'Create a private bucket named "resources" in Supabase Storage',
      });
    }
  } catch (error) {
    logResult({
      name: 'Connection',
      status: 'fail',
      message: 'Failed to connect',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

async function verifyEmailConfiguration() {
  console.log(colors.cyan('\n6. EMAIL CONFIGURATION'));
  console.log('   ' + '─'.repeat(50));

  const provider = process.env.EMAIL_PROVIDER || 'console';

  logResult({
    name: 'Provider',
    status: 'pass',
    message: provider,
    details: provider === 'console' ? 'Emails will be logged to terminal' : 'Real emails will be sent',
  });

  if (provider === 'resend') {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      logResult({
        name: 'Resend API Key',
        status: 'fail',
        message: 'Not set',
        details: 'Required when EMAIL_PROVIDER=resend',
      });
    } else if (apiKey.startsWith('re_')) {
      logResult({
        name: 'Resend API Key',
        status: 'pass',
        message: 'Configured',
      });
    } else {
      logResult({
        name: 'Resend API Key',
        status: 'fail',
        message: 'Invalid format',
        details: 'Should start with re_',
      });
    }
  }

  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  if (fromAddress) {
    logResult({
      name: 'From Address',
      status: 'pass',
      message: fromAddress,
    });
  } else {
    logResult({
      name: 'From Address',
      status: 'warn',
      message: 'Not set (using default)',
    });
  }
}

function printSummary() {
  console.log(colors.cyan('\n═══════════════════════════════════════════════════════════════'));
  console.log(colors.cyan('                        VERIFICATION SUMMARY'));
  console.log(colors.cyan('═══════════════════════════════════════════════════════════════'));

  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const warned = results.filter((r) => r.status === 'warn').length;

  console.log(`\n  ${CHECK} Passed:   ${passed}`);
  console.log(`  ${WARN} Warnings: ${warned}`);
  console.log(`  ${CROSS} Failed:   ${failed}`);

  if (failed > 0) {
    console.log(colors.red('\n  ⚠  Some checks failed. Review the issues above.'));
  } else if (warned > 0) {
    console.log(colors.yellow('\n  ℹ  All critical checks passed. Some optional features may be limited.'));
  } else {
    console.log(colors.green('\n  ✓  All checks passed! Ready for testing.'));
  }

  console.log(colors.cyan('\n═══════════════════════════════════════════════════════════════\n'));
}

async function main() {
  console.log('\n' + colors.cyan('═══════════════════════════════════════════════════════════════'));
  console.log(colors.cyan('               INTEGRATION VERIFICATION CHECK'));
  console.log(colors.cyan('═══════════════════════════════════════════════════════════════'));

  await verifyEnvironmentVariables();
  await verifyDatabaseConnection();
  await verifyStripeConfiguration();
  await verifyDiscordConfiguration();
  await verifySupabaseStorage();
  await verifyEmailConfiguration();

  printSummary();

  // Exit with error code if any critical failures
  const failed = results.filter((r) => r.status === 'fail').length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Verification failed:', error);
  process.exit(1);
});
