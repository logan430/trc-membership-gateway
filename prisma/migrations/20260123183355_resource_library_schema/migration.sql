-- Migration: resource_library_schema
-- Zero-downtime patterns applied
--
-- Changes:
-- 1. Add ResourceStatus enum
-- 2. Create ResourceTag table for admin-managed tag list
-- 3. Create ResourceVersion table for version history
-- 4. Evolve Resource model: remove category, add flat tags, versioning, and publishing states
-- 5. Migrate existing fileUrl -> storagePath before dropping column

-- CreateEnum
CREATE TYPE "ResourceStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SCHEDULED');

-- Step 1: Add new columns to Resource (non-breaking)
ALTER TABLE "Resource"
ADD COLUMN IF NOT EXISTS "author" TEXT,
ADD COLUMN IF NOT EXISTS "currentVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "fileSize" INTEGER,
ADD COLUMN IF NOT EXISTS "mimeType" TEXT,
ADD COLUMN IF NOT EXISTS "publishAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "status" "ResourceStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN IF NOT EXISTS "storagePath" TEXT,
ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "uploadedBy" TEXT;

-- Step 2: Migrate existing data - copy fileUrl to storagePath
-- This preserves existing resources during the transition
UPDATE "Resource"
SET "storagePath" = "fileUrl"
WHERE "fileUrl" IS NOT NULL AND "storagePath" IS NULL;

-- Step 3: Drop old columns and index (after data migration)
DROP INDEX IF EXISTS "Resource_category_idx";
ALTER TABLE "Resource" DROP COLUMN IF EXISTS "category";
ALTER TABLE "Resource" DROP COLUMN IF EXISTS "fileUrl";

-- Step 4: Drop unused enum
DROP TYPE IF EXISTS "ResourceCategory";

-- Step 5: Create ResourceTag table
CREATE TABLE IF NOT EXISTS "ResourceTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "ResourceTag_pkey" PRIMARY KEY ("id")
);

-- Step 6: Create ResourceVersion table
CREATE TABLE IF NOT EXISTS "ResourceVersion" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileSize" INTEGER,
    "changelog" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceVersion_pkey" PRIMARY KEY ("id")
);

-- Step 7: Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS "ResourceTag_name_key" ON "ResourceTag"("name");
CREATE INDEX IF NOT EXISTS "ResourceTag_name_idx" ON "ResourceTag"("name");
CREATE INDEX IF NOT EXISTS "ResourceVersion_resourceId_idx" ON "ResourceVersion"("resourceId");
CREATE UNIQUE INDEX IF NOT EXISTS "ResourceVersion_resourceId_version_key" ON "ResourceVersion"("resourceId", "version");
CREATE INDEX IF NOT EXISTS "Resource_status_idx" ON "Resource"("status");
CREATE INDEX IF NOT EXISTS "Resource_tags_idx" ON "Resource" USING GIN ("tags");

-- Step 8: Add foreign key with NOT VALID for zero-downtime
-- NOT VALID skips validation of existing rows, allowing concurrent writes
-- Run VALIDATE CONSTRAINT separately during low-traffic window if needed
ALTER TABLE "ResourceVersion"
ADD CONSTRAINT "ResourceVersion_resourceId_fkey"
FOREIGN KEY ("resourceId") REFERENCES "Resource"("id")
ON DELETE CASCADE ON UPDATE CASCADE
NOT VALID;
