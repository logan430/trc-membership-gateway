import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  // Stripe
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),

  // Database (Supabase)
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),

  // Session / JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  // App URL (for magic links, OAuth callbacks)
  APP_URL: z.string().url().default('http://localhost:3000'),

  // Discord (required for bot operations)
  DISCORD_CLIENT_ID: z.string(),
  DISCORD_CLIENT_SECRET: z.string(),
  DISCORD_BOT_TOKEN: z.string(),
  DISCORD_GUILD_ID: z.string(),
  DISCORD_ADMIN_CHANNEL_ID: z.string().optional(),
  DISCORD_REDIRECT_URI: z.string().url().optional(), // OAuth callback URL (e.g., http://localhost:3000/auth/callback)
  DISCORD_INVITE_URL: z.string().url().optional(), // Discord server invite URL for post-payment redirect
  DISCORD_INTRODUCTIONS_CHANNEL_ID: z.string(), // Channel ID for #introductions (intro detection)
  DISCORD_BILLING_SUPPORT_CHANNEL_ID: z.string().optional(), // Channel ID for #billing-support (auto-created if missing)

  // Stripe Products
  STRIPE_INDIVIDUAL_PRICE_ID: z.string().startsWith('price_').optional(), // Individual Monthly price ID
  STRIPE_OWNER_SEAT_PRICE_ID: z.string().startsWith('price_').optional(), // Company owner seat monthly price
  STRIPE_TEAM_SEAT_PRICE_ID: z.string().startsWith('price_').optional(), // Company team seat monthly price

  // Email
  EMAIL_PROVIDER: z.enum(['resend', 'console']).default('console'), // console for dev, resend for prod
  RESEND_API_KEY: z.string().startsWith('re_').optional(), // Required when EMAIL_PROVIDER is 'resend'
  EMAIL_FROM_ADDRESS: z.string().default('The Revenue Council <noreply@revenuecouncil.com>'),
  EMAIL_REPLY_TO: z.string().email().optional().default('support@revenuecouncil.com'),

  // Reconciliation
  RECONCILIATION_AUTO_FIX: z.enum(['true', 'false']).default('false'),
  RECONCILIATION_PAUSED: z.enum(['true', 'false']).default('false'),
  RECONCILIATION_TIMEZONE: z.string().default('America/New_York'),
  RECONCILIATION_HOUR: z.coerce.number().min(0).max(23).default(3), // 3 AM
  ADMIN_EMAIL: z.string().email().optional(), // For reconciliation reports

  // Admin seed (for first super admin creation)
  ADMIN_SEED_EMAIL: z.string().email().optional(),
  ADMIN_SEED_PASSWORD: z.string().min(8).optional(),

  // Error Monitoring (Sentry)
  SENTRY_DSN: z.string().optional(), // Optional - app runs without it

  // Supabase Storage (for resource library)
  SUPABASE_URL: z.string().url().optional(), // Optional until storage operations used
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(), // Service role key for server-side operations

  // Malware Scanning (optional - requires ClamAV daemon)
  ENABLE_MALWARE_SCAN: z.enum(['true', 'false']).optional().default('false'),
  CLAMAV_HOST: z.string().optional(), // e.g., 'localhost' or '127.0.0.1'
  CLAMAV_PORT: z.coerce.number().optional().default(3310),

  // MEE6 Integration
  MEE6_SYNC_ENABLED: z.enum(['true', 'false']).default('false'), // Master toggle for XP sync
  MEE6_GUILD_ID: z.string().optional(), // Override guild ID for MEE6 (defaults to DISCORD_GUILD_ID)
}).refine(
  (data) => data.EMAIL_PROVIDER !== 'resend' || data.RESEND_API_KEY,
  { message: 'RESEND_API_KEY is required when EMAIL_PROVIDER is resend', path: ['RESEND_API_KEY'] }
);

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
