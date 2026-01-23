/**
 * File upload service for resource library.
 * Handles Multer middleware and Supabase Storage uploads.
 */
import multer from 'multer';
import { RequestHandler } from 'express';
import { getSupabaseClient } from '../lib/supabase.js';
import { validateFileType } from '../lib/file-validation.js';
import { scanForMalware, isMalwareScanEnabled } from './malware-scan.js';
import { logger } from '../index.js';
import { MAX_FILE_SIZE, BUCKET_NAME, ALLOWED_EXTENSIONS, UploadResult } from './types.js';

// Multer memory storage - file available in req.file.buffer
const storage = multer.memoryStorage();

// Preliminary extension filter (magic number validation happens after)
const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ext = '.' + file.originalname.split('.').pop()?.toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    cb(new Error(`File extension ${ext} not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`));
    return;
  }
  cb(null, true);
};

/**
 * Multer middleware for single file upload.
 * SEC-01: 100MB limit
 * SEC-02: Extension pre-filter (magic validation after)
 *
 * Usage: router.post('/upload', uploadMiddleware, async (req, res) => { ... })
 */
export const uploadMiddleware: RequestHandler = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter,
}).single('file');

/**
 * Upload validated file to Supabase Storage.
 * Call AFTER uploadMiddleware and validateFileType.
 * Includes optional malware scan (SEC-04).
 *
 * @param buffer - File content as Buffer (from req.file.buffer)
 * @param originalFilename - Original filename (for path generation)
 * @param adminId - ID of admin performing upload
 * @param validatedMime - MIME type from validateFileType
 * @returns Upload result with storage path
 * @throws Error if malware detected or upload fails
 */
export async function uploadToStorage(
  buffer: Buffer,
  originalFilename: string,
  adminId: string,
  validatedMime: string
): Promise<UploadResult> {
  // SEC-04: Malware scan (if enabled)
  const scanResult = await scanForMalware(buffer, originalFilename);
  if (!scanResult.clean) {
    throw new Error(`File rejected: malware detected (${scanResult.threat})`);
  }

  const supabase = getSupabaseClient();

  // Generate unique path: uploads/{adminId}/{timestamp}-{sanitized-filename}
  const timestamp = Date.now();
  const safeFilename = originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `uploads/${adminId}/${timestamp}-${safeFilename}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, buffer, {
      contentType: validatedMime,
      upsert: false, // Fail if exists (unique paths anyway)
    });

  if (error) {
    logger.error({ error, storagePath }, 'Failed to upload to Supabase Storage');
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  logger.info({
    storagePath,
    fileSize: buffer.length,
    mimeType: validatedMime,
    malwareScanned: scanResult.scanned,
  }, 'File uploaded to storage');

  return {
    storagePath,
    fileSize: buffer.length,
    mimeType: validatedMime,
  };
}

/**
 * Delete file from Supabase Storage.
 * Used when resource is deleted or version pruned.
 *
 * @param storagePath - Path to file in storage bucket
 */
export async function deleteFromStorage(storagePath: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([storagePath]);

  if (error) {
    logger.error({ error, storagePath }, 'Failed to delete from Supabase Storage');
    throw new Error(`Failed to delete file: ${error.message}`);
  }

  logger.info({ storagePath }, 'File deleted from storage');
}

/**
 * Re-export for convenience in routes.
 */
export { validateFileType } from '../lib/file-validation.js';
export { isMalwareScanEnabled };
