# Phase 29: Resource Library & File Storage - Research

**Researched:** 2026-01-23
**Domain:** File upload/download, Supabase Storage, magic number validation, signed URLs
**Confidence:** HIGH

## Summary

This phase builds a secure admin-curated file library with Supabase Storage backend. The core challenges are: (1) secure file uploads with magic number validation to prevent extension spoofing, (2) Supabase Storage integration for private bucket storage with signed URLs, (3) proper schema evolution from existing Resource model to support flat tags, versioning, and publishing states, and (4) integration with the existing points system for download rewards.

The existing codebase uses Supabase for database via Prisma but does NOT have Supabase Storage client configured. This phase must add the `@supabase/supabase-js` client for storage operations (the server-side service role client pattern). The Resource and ResourceDownload tables exist in schema but need significant modifications for flat tags, versioning, and publishing states per CONTEXT.md decisions.

**Primary recommendation:** Use a private Supabase Storage bucket with server-side signed URL generation. Implement magic number validation via the `file-type` npm package. Evolve the existing Resource schema with migrations. Use Multer for multipart form handling with memory storage (no temp files).

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.x | Supabase Storage client | Official SDK, supports storage.upload/createSignedUrl |
| multer | 1.4.5 | Multipart form handling | Express standard, memory storage option |
| file-type | 21.x | Magic number validation | ESM, detects PDF/DOCX/XLSX/MP4/ZIP, 10M+ weekly downloads |
| express-rate-limit | 8.2.1 | Upload rate limiting | Already in project dependencies |
| Prisma | 7.2.0 | Database ORM | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| clamscan | 2.4.0 | Malware scanning | Optional - requires ClamAV daemon |
| @types/multer | Latest | TypeScript types | Dev dependency |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| file-type | magic-bytes.js | magic-bytes.js is smaller but file-type has better TS support and is more maintained |
| Supabase Storage | S3 direct | S3 would require separate setup; Supabase already part of infrastructure |
| ClamAV | VirusTotal API | VirusTotal requires internet call per file; ClamAV runs locally |

**Installation:**
```bash
npm install @supabase/supabase-js multer file-type
npm install --save-dev @types/multer
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    supabase.ts          # Supabase client with service role key
    file-validation.ts   # Magic number + MIME type validation
  storage/
    upload.ts            # File upload service
    download.ts          # Signed URL generation
    types.ts             # Storage types and allowed file types
  routes/
    admin/
      resources.ts       # Admin CRUD + upload endpoints
    resources.ts         # Member browse/download endpoints
prisma/
  migrations/
    xxx_resource_tags/   # Flat tags migration
    xxx_resource_version/# Versioning support migration
```

### Pattern 1: Supabase Storage Client (Server-Side with Service Role)

**What:** Server-side Supabase client using service role key to bypass RLS for storage operations.

**When to use:** All storage operations (upload, signed URL generation, delete).

**Example:**
```typescript
// src/lib/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get Supabase client with service role key
 * Service role bypasses RLS - use only for server-side operations
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }
    supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseClient;
}
```

### Pattern 2: Magic Number Validation with file-type

**What:** Validate uploaded files by inspecting binary header, not just extension.

**When to use:** Every file upload before storing to Supabase.

**Example:**
```typescript
// src/lib/file-validation.ts
import { fileTypeFromBuffer } from 'file-type';

// CONTEXT.md: Allowed types - PDF, DOCX, XLSX, MP4, ZIP
// Note: DOCX, XLSX are ZIP-based (application/zip with specific structure)
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',                                           // PDF
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // XLSX
  'video/mp4',                                                 // MP4
  'application/zip',                                           // ZIP (also covers DOCX/XLSX)
  'application/x-zip-compressed',                              // ZIP variant
]);

// Map file extensions to expected MIME types for double-check
const EXTENSION_MIME_MAP: Record<string, string[]> = {
  pdf: ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'],
  mp4: ['video/mp4'],
  zip: ['application/zip', 'application/x-zip-compressed'],
};

// SEC-03: Block SVG explicitly (XSS prevention)
const BLOCKED_MIME_TYPES = new Set([
  'image/svg+xml',
  'application/xml',
  'text/xml',
]);

export interface ValidationResult {
  valid: boolean;
  detectedMime?: string;
  detectedExt?: string;
  error?: string;
}

/**
 * Validate file by magic number (binary header inspection)
 * Returns detected MIME type or validation error
 */
export async function validateFileType(
  buffer: Buffer,
  originalFilename: string
): Promise<ValidationResult> {
  // Detect actual file type from binary
  const detected = await fileTypeFromBuffer(buffer);

  if (!detected) {
    return {
      valid: false,
      error: 'Could not detect file type from binary content',
    };
  }

  // Block dangerous types
  if (BLOCKED_MIME_TYPES.has(detected.mime)) {
    return {
      valid: false,
      detectedMime: detected.mime,
      error: `File type ${detected.mime} is not allowed (security risk)`,
    };
  }

  // Check if detected MIME is in allowed list
  if (!ALLOWED_MIME_TYPES.has(detected.mime)) {
    return {
      valid: false,
      detectedMime: detected.mime,
      detectedExt: detected.ext,
      error: `File type ${detected.mime} is not allowed. Allowed: PDF, DOCX, XLSX, MP4, ZIP`,
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
        error: `File extension .${ext} does not match detected type ${detected.mime}`,
      };
    }
  }

  return {
    valid: true,
    detectedMime: detected.mime,
    detectedExt: detected.ext,
  };
}
```

### Pattern 3: Multer Memory Storage with Size Limits

**What:** Handle multipart uploads with in-memory buffer, enforcing size limits.

**When to use:** Admin file upload endpoint.

**Example:**
```typescript
// src/storage/upload.ts
import multer from 'multer';
import { RequestHandler } from 'express';

// SEC-01: 100MB file size limit
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB in bytes

// Memory storage - file available as req.file.buffer
const storage = multer.memoryStorage();

// File filter - basic extension check (magic number validation happens after)
const fileFilter: multer.Options['fileFilter'] = (req, file, cb) => {
  const allowedExtensions = ['.pdf', '.docx', '.xlsx', '.mp4', '.zip'];
  const ext = '.' + file.originalname.split('.').pop()?.toLowerCase();

  if (!allowedExtensions.includes(ext)) {
    cb(new Error(`File extension ${ext} not allowed`));
    return;
  }

  cb(null, true);
};

export const uploadMiddleware: RequestHandler = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1, // Single file at a time
  },
  fileFilter,
}).single('file');
```

### Pattern 4: Signed URL Generation with Content-Disposition

**What:** Generate time-limited download URLs with attachment header.

**When to use:** Member download requests.

**Example:**
```typescript
// src/storage/download.ts
import { getSupabaseClient } from '../lib/supabase.js';
import { logger } from '../index.js';

const BUCKET_NAME = 'resources';
const SIGNED_URL_EXPIRY = 3600; // SEC-05: 1 hour in seconds

export interface SignedUrlResult {
  url: string;
  expiresAt: Date;
}

/**
 * Generate signed download URL for a resource file
 * SEC-06: Includes Content-Disposition: attachment
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

  return {
    url: data.signedUrl,
    expiresAt: new Date(Date.now() + SIGNED_URL_EXPIRY * 1000),
  };
}
```

### Pattern 5: Rate Limiting for Uploads

**What:** Limit upload frequency per admin.

**When to use:** File upload endpoint.

**Example:**
```typescript
// src/middleware/rate-limit.ts (extend existing file)
import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for file uploads
 * SEC-07: 5 files per hour per admin (keyed by admin ID from session)
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Upload limit reached. You can upload up to 5 files per hour.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Key by admin ID from authenticated session
    const adminId = (req as any).adminId || req.ip;
    return `upload:${adminId}`;
  },
});
```

### Pattern 6: Resource Schema Evolution (Flat Tags + Versioning)

**What:** Evolve Resource model for flat tags, publishing states, and version history.

**Migration approach:**
```sql
-- Migration 1: Add flat tags support
-- Remove category enum column, add tags array
ALTER TABLE "Resource" ADD COLUMN "tags" TEXT[] DEFAULT '{}';

-- Create ResourceTag table for admin-managed tag list
CREATE TABLE "ResourceTag" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT -- Admin ID
);

-- Add index for tag queries
CREATE INDEX "Resource_tags_idx" ON "Resource" USING GIN ("tags");

-- Migration 2: Add versioning and publishing
CREATE TYPE "ResourceStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SCHEDULED');

ALTER TABLE "Resource"
  ADD COLUMN "status" "ResourceStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "publishAt" TIMESTAMP(3),
  ADD COLUMN "uploadedBy" TEXT, -- Admin who uploaded (internal tracking)
  ADD COLUMN "author" TEXT, -- Public attribution (optional)
  ADD COLUMN "fileSize" INTEGER,
  ADD COLUMN "mimeType" TEXT,
  ADD COLUMN "storagePath" TEXT; -- Supabase Storage path (not direct URL)

-- Create ResourceVersion table for version history
CREATE TABLE "ResourceVersion" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "resourceId" TEXT NOT NULL REFERENCES "Resource"("id") ON DELETE CASCADE,
  "version" INTEGER NOT NULL DEFAULT 1,
  "storagePath" TEXT NOT NULL,
  "fileSize" INTEGER,
  "changelog" TEXT, -- Optional notes for this version
  "uploadedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("resourceId", "version")
);

CREATE INDEX "ResourceVersion_resourceId_idx" ON "ResourceVersion"("resourceId");
```

### Anti-Patterns to Avoid

- **Storing files directly in database:** Use Supabase Storage, store only path in DB
- **Trusting file extensions:** Always validate magic numbers before storing
- **Public bucket for sensitive files:** Use private bucket with signed URLs
- **Returning raw Supabase URLs to client:** Generate server-side signed URLs
- **Missing Content-Disposition:** Download URLs must include attachment header
- **Blocking DOCX validation as ZIP:** DOCX/XLSX are ZIP-based, allow both MIME types

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File type detection | Manual header parsing | file-type library | Handles 100+ formats, maintained |
| Multipart parsing | Manual buffer handling | Multer | Battle-tested, handles edge cases |
| Signed URL generation | Manual token signing | Supabase SDK | Built-in, handles expiration |
| Rate limiting | Manual counter in DB | express-rate-limit | Already in project, memory-efficient |
| Virus scanning | Custom scanner | ClamAV + clamscan | Industry standard, updated definitions |

**Key insight:** Office formats (DOCX, XLSX, PPTX) are ZIP archives internally. The `file-type` library will detect them as `application/zip` initially. For stricter validation, you must inspect the ZIP contents for `[Content_Types].xml` which differentiates Office formats from regular ZIPs.

## Common Pitfalls

### Pitfall 1: file-type is ESM-only

**What goes wrong:** Import error when trying to use `require('file-type')`.

**Why it happens:** file-type v17+ is pure ESM, cannot use CommonJS require.

**How to avoid:**
- Project already uses ESM (`"type": "module"` in package.json)
- Use `import { fileTypeFromBuffer } from 'file-type';`
- Ensure TypeScript compiles to ES modules

**Warning signs:** "ERR_REQUIRE_ESM" error at runtime.

### Pitfall 2: DOCX/XLSX Detected as ZIP

**What goes wrong:** Valid DOCX file rejected because detected MIME is "application/zip".

**Why it happens:** Office Open XML formats are ZIP archives containing XML files.

**How to avoid:**
```typescript
// Accept both specific Office MIME and generic ZIP for Office extensions
const extensionMimeMap = {
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'],
};
```

**Warning signs:** Users report "valid DOCX files rejected" or "upload failed for Office documents".

### Pitfall 3: Missing Supabase Storage Bucket

**What goes wrong:** Upload fails with "Bucket not found" error.

**Why it happens:** Supabase Storage buckets must be created manually in dashboard or via SQL migration.

**How to avoid:**
- Create bucket `resources` in Supabase dashboard before deployment
- Set bucket to PRIVATE (not public)
- Document bucket creation in deployment runbook

**Warning signs:** "Error: Bucket 'resources' not found" in logs.

### Pitfall 4: Signed URL Expiration Not Handled

**What goes wrong:** User clicks download link, gets 403 Forbidden because URL expired.

**Why it happens:** Signed URL created when page loaded, user clicks later after expiry.

**How to avoid:**
- Generate signed URL at download request time, not page render
- Return URL with expiration time so frontend can warn user
- Consider shorter TTL (1 hour per spec) with on-demand regeneration

**Warning signs:** Intermittent "403 Forbidden" on downloads, especially for slow users.

### Pitfall 5: Large File Upload Timeout

**What goes wrong:** 100MB file upload fails with timeout or connection reset.

**Why it happens:** Default Express timeout, slow upload speed, memory limits.

**How to avoid:**
```typescript
// In route handler or middleware
req.setTimeout(10 * 60 * 1000); // 10 minute timeout for uploads

// In index.ts server config
app.use(express.json({ limit: '1mb' })); // Keep JSON small
// Multer handles multipart separately with its own limits
```

**Warning signs:** Upload fails at ~80% progress, works for small files only.

### Pitfall 6: Version History Bloat

**What goes wrong:** Storage costs grow unbounded as admins upload new versions.

**Why it happens:** No version retention policy implemented.

**How to avoid (Claude's Discretion):**
- Recommend keeping last 5 versions per resource
- Background job to purge older versions weekly
- Store total storage usage, alert if exceeding threshold

**Warning signs:** Supabase Storage bill increases significantly month-over-month.

## Code Examples

Verified patterns from codebase and official documentation:

### Upload File to Supabase Storage
```typescript
// Source: Supabase official docs - Standard Uploads
import { getSupabaseClient } from '../lib/supabase.js';
import { validateFileType } from '../lib/file-validation.js';
import { logger } from '../index.js';

const BUCKET_NAME = 'resources';

export async function uploadResourceFile(
  buffer: Buffer,
  originalFilename: string,
  adminId: string
): Promise<{ storagePath: string; fileSize: number; mimeType: string }> {
  // Validate file type via magic number
  const validation = await validateFileType(buffer, originalFilename);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Generate unique storage path: adminId/timestamp-filename
  const timestamp = Date.now();
  const safeFilename = originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `uploads/${adminId}/${timestamp}-${safeFilename}`;

  const supabase = getSupabaseClient();

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, buffer, {
      contentType: validation.detectedMime,
      upsert: false, // Fail if exists (unique paths anyway)
    });

  if (error) {
    logger.error({ error, storagePath }, 'Failed to upload to Supabase Storage');
    throw new Error('Failed to upload file to storage');
  }

  logger.info({ storagePath, fileSize: buffer.length, mimeType: validation.detectedMime }, 'File uploaded');

  return {
    storagePath,
    fileSize: buffer.length,
    mimeType: validation.detectedMime!,
  };
}
```

### Download with Points Award
```typescript
// Integration with existing points service
import { generateSignedUrl } from '../storage/download.js';
import { awardDownloadPoints } from '../points/service.js';
import { prisma } from '../lib/prisma.js';

export async function handleResourceDownload(
  memberId: string,
  resourceId: string
): Promise<{ url: string; expiresAt: Date; pointsAwarded: boolean }> {
  // Fetch resource
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId, status: 'PUBLISHED' },
  });

  if (!resource) {
    throw new Error('Resource not found');
  }

  // Generate signed URL
  const { url, expiresAt } = await generateSignedUrl(
    resource.storagePath,
    resource.title
  );

  // Record download (for analytics)
  await prisma.resourceDownload.create({
    data: {
      memberId,
      resourceId,
    },
  });

  // Increment download count (denormalized)
  await prisma.resource.update({
    where: { id: resourceId },
    data: { downloadCount: { increment: 1 } },
  });

  // Award points (idempotent - first download only per CONTEXT.md decision)
  // Using existing awardDownloadPoints from points service
  const pointsResult = await awardDownloadPoints(memberId, resourceId, resource.title);

  return {
    url,
    expiresAt,
    pointsAwarded: pointsResult.awarded,
  };
}
```

### Admin Resource CRUD Route
```typescript
// src/routes/admin/resources.ts
import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireSuperAdmin } from '../../admin/middleware.js';
import { uploadMiddleware } from '../../storage/upload.js';
import { uploadLimiter } from '../../middleware/rate-limit.js';
import { uploadResourceFile } from '../../storage/upload.js';
import { prisma } from '../../lib/prisma.js';
import { logAuditEvent, AuditAction } from '../../lib/audit.js';

export const adminResourcesRouter = Router();

// Create resource schema
const createResourceSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000),
  tags: z.array(z.string()).default([]),
  type: z.enum(['TEMPLATE', 'SOP', 'PLAYBOOK', 'COURSE', 'VIDEO']),
  author: z.string().optional(), // Public attribution
  status: z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED']).default('DRAFT'),
  publishAt: z.string().datetime().optional(),
  isFeatured: z.boolean().default(false),
});

/**
 * POST /api/admin/resources
 * Upload new resource file with metadata
 */
adminResourcesRouter.post(
  '/',
  requireAdmin,
  uploadLimiter, // SEC-07: Rate limit
  uploadMiddleware, // Multer middleware
  async (req, res) => {
    const admin = res.locals.admin!;

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    try {
      const metadata = createResourceSchema.parse(JSON.parse(req.body.metadata || '{}'));

      // Upload to Supabase Storage
      const uploadResult = await uploadResourceFile(
        req.file.buffer,
        req.file.originalname,
        admin.id
      );

      // Create database record
      const resource = await prisma.resource.create({
        data: {
          title: metadata.title,
          description: metadata.description,
          tags: metadata.tags,
          type: metadata.type,
          status: metadata.status,
          publishAt: metadata.publishAt ? new Date(metadata.publishAt) : null,
          isFeatured: metadata.isFeatured,
          author: metadata.author,
          uploadedBy: admin.id,
          storagePath: uploadResult.storagePath,
          fileSize: uploadResult.fileSize,
          mimeType: uploadResult.mimeType,
        },
      });

      // Create initial version record
      await prisma.resourceVersion.create({
        data: {
          resourceId: resource.id,
          version: 1,
          storagePath: uploadResult.storagePath,
          fileSize: uploadResult.fileSize,
          uploadedBy: admin.id,
        },
      });

      // Audit log
      await logAuditEvent({
        action: 'RESOURCE_CREATED',
        entityType: 'Resource',
        entityId: resource.id,
        details: { title: resource.title, type: resource.type },
        performedBy: admin.id,
      });

      res.status(201).json({ resource });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid metadata', details: error.issues });
        return;
      }
      throw error;
    }
  }
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Extension-only validation | Magic number + extension | Always recommended | Prevents extension spoofing |
| Public storage URLs | Signed URLs with expiration | Security best practice | Time-limited access |
| Hierarchical categories | Flat tags (per CONTEXT.md) | User decision | Simpler, more flexible |
| Single file version | Version history | User decision | Audit trail, rollback |

**Deprecated/outdated:**
- file-type v16 and below (CommonJS) - use v17+ ESM
- @supabase/storage-js standalone - moved to @supabase/supabase-js monorepo
- Node.js 18 support for Supabase - dropped October 2025

## Open Questions

Things that couldn't be fully resolved:

1. **ClamAV Integration Scope**
   - What we know: SEC-04 requires malware scanning; clamscan npm package available
   - What's unclear: Is ClamAV daemon available in production environment?
   - Recommendation: Make malware scanning optional/configurable via feature flag; document ClamAV installation in deployment runbook

2. **Scheduled Publishing Job**
   - What we know: Resources can have SCHEDULED status with publishAt date
   - What's unclear: How frequently should scheduled publishing be checked?
   - Recommendation: Add to existing node-cron pattern (e.g., check every 5 minutes)

3. **Resource Recommendations (RES-15)**
   - What we know: Context-based recommendations based on member profile
   - What's unclear: What profile attributes should drive recommendations?
   - Recommendation: Start simple - recommend by matching resource tags to member's downloaded resource tags; defer ML-based recommendations

4. **DOCX/XLSX Deep Validation**
   - What we know: These are ZIP files; file-type detects as ZIP
   - What's unclear: Do we need to validate internal structure (Content_Types.xml)?
   - Recommendation: Accept ZIP MIME for .docx/.xlsx extensions; add deep validation later if abuse detected

## Sources

### Primary (HIGH confidence)
- Supabase Official Docs - [Storage Upload](https://supabase.com/docs/reference/javascript/storage-from-upload) - Upload API
- Supabase Official Docs - [createSignedUrl](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl) - Signed URL API
- Supabase Official Docs - [Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control) - Private bucket patterns
- GitHub sindresorhus/file-type - [Repository](https://github.com/sindresorhus/file-type) - Magic number detection
- Express.js - [Multer Middleware](https://expressjs.com/en/resources/middleware/multer.html) - File upload handling
- Existing codebase: `src/middleware/rate-limit.ts` - Rate limiting patterns
- Existing codebase: `src/points/service.ts` - awardDownloadPoints function
- Existing codebase: `prisma/schema.prisma` - Resource/ResourceDownload models

### Secondary (MEDIUM confidence)
- npm file-type - ESM usage patterns, supported MIME types
- npm clamscan - ClamAV integration patterns
- Wikipedia - [List of file signatures](https://en.wikipedia.org/wiki/List_of_file_signatures) - Magic bytes reference

### Tertiary (LOW confidence)
- Medium articles on file validation - General patterns (verify with official docs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via official docs
- Architecture: HIGH - Patterns adapted from existing codebase + Supabase docs
- Pitfalls: HIGH - Based on official ESM requirements and verified MIME type behavior

**Research date:** 2026-01-23
**Valid until:** 2026-04-23 (90 days - Supabase SDK stable, file-type mature)

---

**Key Files for This Phase:**
- `src/config/env.ts` - Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
- `src/middleware/rate-limit.ts` - Add uploadLimiter
- `src/points/service.ts` - Existing awardDownloadPoints function
- `src/lib/audit.ts` - Add RESOURCE_* audit actions
- `prisma/schema.prisma` - Evolve Resource model
- `.env.example` - Document new Supabase env vars

**Environment Variables to Add:**
```
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
```
