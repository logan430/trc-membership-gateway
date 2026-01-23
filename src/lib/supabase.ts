import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get Supabase client with service role key.
 * Service role bypasses RLS - use only for server-side operations.
 *
 * @throws Error if SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    if (!env.SUPABASE_URL) {
      throw new Error(
        'SUPABASE_URL not configured. Set SUPABASE_URL in your environment variables. ' +
          'Get it from: Supabase Dashboard -> Project Settings -> API -> Project URL'
      );
    }
    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY not configured. Set SUPABASE_SERVICE_ROLE_KEY in your environment variables. ' +
          'Get it from: Supabase Dashboard -> Project Settings -> API -> Service Role Key (keep this secret!)'
      );
    }

    supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        // Service role client doesn't need auth features
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return supabaseClient;
}

/**
 * Check if Supabase Storage is configured.
 * Useful for conditional logic without throwing errors.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}
