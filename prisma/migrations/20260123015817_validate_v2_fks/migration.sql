-- Validate all v2.0 foreign key constraints
-- This runs while allowing concurrent reads/writes

ALTER TABLE "BenchmarkSubmission" VALIDATE CONSTRAINT "BenchmarkSubmission_memberId_fkey";
ALTER TABLE "ResourceDownload" VALIDATE CONSTRAINT "ResourceDownload_memberId_fkey";
ALTER TABLE "ResourceDownload" VALIDATE CONSTRAINT "ResourceDownload_resourceId_fkey";
ALTER TABLE "PointTransaction" VALIDATE CONSTRAINT "PointTransaction_memberId_fkey";
ALTER TABLE "DiscordActivity" VALIDATE CONSTRAINT "DiscordActivity_memberId_fkey";
