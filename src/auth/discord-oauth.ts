import { env } from '../config/env.js';

// Discord API endpoints
const DISCORD_API_BASE = 'https://discord.com/api';
const DISCORD_AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';

// Response types
export interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
  discriminator: string; // "0" for new usernames
}

/**
 * Generate Discord OAuth2 authorization URL
 * Uses authorization code grant flow (not implicit)
 */
export function generateAuthUrl(state: string): string {
  const redirectUri = env.DISCORD_REDIRECT_URI ?? `${env.APP_URL}/auth/callback`;
  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify', // No email - comes from Stripe per CONTEXT.md
    state,
  });

  return `${DISCORD_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 * CRITICAL: Must use application/x-www-form-urlencoded per RESEARCH.md
 */
export async function exchangeCode(code: string): Promise<DiscordTokenResponse> {
  const redirectUri = env.DISCORD_REDIRECT_URI ?? `${env.APP_URL}/auth/callback`;
  const response = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Discord token exchange failed: ${response.status} - ${error}`);
  }

  return response.json() as Promise<DiscordTokenResponse>;
}

/**
 * Fetch Discord user info using access token
 */
export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  const response = await fetch(`${DISCORD_API_BASE}/users/@me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Discord user fetch failed: ${response.status} - ${error}`);
  }

  return response.json() as Promise<DiscordUser>;
}
