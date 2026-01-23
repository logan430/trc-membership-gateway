/**
 * Storage service constants and types.
 * Per security requirements from 29-CONTEXT.md.
 */

// SEC-01: 100MB file size limit
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

// Supabase Storage bucket name (must be created in Supabase dashboard)
export const BUCKET_NAME = 'resources';

// SEC-05: Signed URL expiration (1 hour in seconds)
export const SIGNED_URL_EXPIRY = 3600;

// Allowed extensions for preliminary check (magic number validation is authoritative)
export const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.mp4', '.zip'];

/**
 * Result of uploading a file to storage
 */
export interface UploadResult {
  /** Storage path within the bucket */
  storagePath: string;
  /** File size in bytes */
  fileSize: number;
  /** Validated MIME type */
  mimeType: string;
}

/**
 * Result of generating a signed download URL
 */
export interface SignedUrlResult {
  /** Signed download URL */
  url: string;
  /** Expiration time of the URL */
  expiresAt: Date;
}

/**
 * Result of malware scan
 */
export interface MalwareScanResult {
  /** True if no malware detected */
  clean: boolean;
  /** Threat name if malware detected */
  threat?: string;
  /** False if scanning disabled or unavailable */
  scanned: boolean;
}
