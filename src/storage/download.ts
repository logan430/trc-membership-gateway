/**
 * File download service for resource library.
 * Generates signed URLs for secure file access.
 */
import { getSupabaseClient } from '../lib/supabase.js';
import { logger } from '../index.js';
import { BUCKET_NAME, SIGNED_URL_EXPIRY, SignedUrlResult } from './types.js';

/**
 * Generate signed download URL for a resource file.
 * SEC-05: 1-hour expiration
 * SEC-06: Content-Disposition: attachment header via download option
 *
 * @param storagePath - Path to file in storage bucket
 * @param filename - Filename for Content-Disposition header
 * @returns Signed URL and expiration time
 * @throws Error if URL generation fails
 */
export async function generateSignedUrl(
  storagePath: string,
  filename: string
): Promise<SignedUrlResult> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY, {
      download: filename, // Sets Content-Disposition: attachment; filename="..."
    });

  if (error || !data?.signedUrl) {
    logger.error({ error, storagePath }, 'Failed to create signed URL');
    throw new Error('Failed to generate download URL');
  }

  logger.debug({ storagePath, filename, expiresIn: SIGNED_URL_EXPIRY }, 'Generated signed download URL');

  return {
    url: data.signedUrl,
    expiresAt: new Date(Date.now() + SIGNED_URL_EXPIRY * 1000),
  };
}

/**
 * Generate signed URL without Content-Disposition (for inline viewing).
 * Use this for previewing PDFs or videos in browser.
 *
 * @param storagePath - Path to file in storage bucket
 * @returns Signed URL and expiration time
 */
export async function generatePreviewUrl(storagePath: string): Promise<SignedUrlResult> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY);

  if (error || !data?.signedUrl) {
    logger.error({ error, storagePath }, 'Failed to create preview URL');
    throw new Error('Failed to generate preview URL');
  }

  return {
    url: data.signedUrl,
    expiresAt: new Date(Date.now() + SIGNED_URL_EXPIRY * 1000),
  };
}
