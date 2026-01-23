import { fileTypeFromBuffer } from 'file-type';

/**
 * Allowed MIME types for resource library uploads.
 * Per CONTEXT.md: PDF, DOCX, XLSX, MP4, ZIP
 *
 * Note: DOCX/XLSX are ZIP-based internally, so file-type may detect them as application/zip.
 * This is handled in the extension cross-validation logic.
 */
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf', // PDF
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
  'video/mp4', // MP4
  'application/zip', // ZIP (also covers DOCX/XLSX internals)
  'application/x-zip-compressed', // ZIP variant
]);

/**
 * Blocked MIME types for security.
 * Per SEC-03: SVG files are blocked due to XSS risk.
 */
const BLOCKED_MIME_TYPES = new Set([
  'image/svg+xml',
  'application/xml',
  'text/xml',
]);

/**
 * Map file extensions to expected MIME types.
 * Used to prevent extension spoofing attacks.
 *
 * DOCX/XLSX may be detected as ZIP by file-type since they are ZIP archives.
 * We allow both the specific Office MIME and generic ZIP for Office extensions.
 */
const EXTENSION_MIME_MAP: Record<string, string[]> = {
  pdf: ['application/pdf'],
  docx: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
  ],
  xlsx: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
  ],
  mp4: ['video/mp4'],
  zip: ['application/zip', 'application/x-zip-compressed'],
};

/**
 * Result of file type validation.
 */
export interface ValidationResult {
  /** Whether the file passed validation */
  valid: boolean;
  /** Detected MIME type from file content */
  detectedMime?: string;
  /** Detected file extension from file content */
  detectedExt?: string;
  /** Error message if validation failed */
  error?: string;
}

/**
 * Validate file type via magic number (binary header inspection).
 * Does NOT trust the file extension - validates actual content.
 *
 * @param buffer - File content as Buffer
 * @param originalFilename - Original filename (used for extension cross-check)
 * @returns Validation result with detected MIME type or error
 *
 * @example
 * ```ts
 * const result = await validateFileType(buffer, 'document.pdf');
 * if (!result.valid) {
 *   throw new Error(result.error);
 * }
 * // result.detectedMime = 'application/pdf'
 * ```
 */
export async function validateFileType(
  buffer: Buffer,
  originalFilename: string
): Promise<ValidationResult> {
  // Detect actual file type from binary content
  const detected = await fileTypeFromBuffer(buffer);

  if (!detected) {
    return {
      valid: false,
      error: 'Could not detect file type from binary content. The file may be corrupted or an unsupported format.',
    };
  }

  // Block dangerous types (SEC-03: SVG XSS prevention)
  if (BLOCKED_MIME_TYPES.has(detected.mime)) {
    return {
      valid: false,
      detectedMime: detected.mime,
      error: `File type ${detected.mime} is not allowed (security risk). SVG and XML files are blocked.`,
    };
  }

  // Check if detected MIME is in allowed list
  if (!ALLOWED_MIME_TYPES.has(detected.mime)) {
    return {
      valid: false,
      detectedMime: detected.mime,
      detectedExt: detected.ext,
      error: `File type ${detected.mime} is not allowed. Allowed types: PDF, DOCX, XLSX, MP4, ZIP`,
    };
  }

  // Cross-check: extension should match detected type (prevent extension spoofing)
  const ext = originalFilename.split('.').pop()?.toLowerCase();
  if (ext && EXTENSION_MIME_MAP[ext]) {
    const expectedMimes = EXTENSION_MIME_MAP[ext];
    if (!expectedMimes.includes(detected.mime)) {
      return {
        valid: false,
        detectedMime: detected.mime,
        error: `File extension .${ext} does not match detected content type ${detected.mime}. This may indicate file spoofing.`,
      };
    }
  }

  return {
    valid: true,
    detectedMime: detected.mime,
    detectedExt: detected.ext,
  };
}

/**
 * Get human-readable file type name from MIME type.
 * Useful for UI display.
 */
export function getMimeTypeLabel(mimeType: string): string {
  switch (mimeType) {
    case 'application/pdf':
      return 'PDF Document';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return 'Word Document';
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return 'Excel Spreadsheet';
    case 'video/mp4':
      return 'MP4 Video';
    case 'application/zip':
    case 'application/x-zip-compressed':
      return 'ZIP Archive';
    default:
      return 'Unknown';
  }
}

/**
 * Check if a file extension is allowed (basic check before upload).
 * This is a quick pre-check; full validation requires binary inspection.
 */
export function isAllowedExtension(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? ext in EXTENSION_MIME_MAP : false;
}
