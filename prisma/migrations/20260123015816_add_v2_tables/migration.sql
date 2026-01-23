-- CreateEnum
CREATE TYPE "BenchmarkCategory" AS ENUM ('COMPENSATION', 'INFRASTRUCTURE', 'BUSINESS', 'OPERATIONAL');

-- CreateEnum
CREATE TYPE "ResourceCategory" AS ENUM ('COLD_EMAIL', 'SALES_GTM', 'CUSTOMER_SERVICE', 'OPERATIONS', 'AGENCY_GROWTH');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('TEMPLATE', 'SOP', 'PLAYBOOK', 'COURSE', 'VIDEO');

-- CreateEnum
CREATE TYPE "DiscordActivityType" AS ENUM ('MESSAGE', 'REACTION_GIVEN', 'REACTION_RECEIVED');

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "currentStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastActiveAt" TIMESTAMP(3),
ADD COLUMN     "totalPoints" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "BenchmarkSubmission" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "category" "BenchmarkCategory" NOT NULL,
    "data" JSONB NOT NULL,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BenchmarkSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ResourceCategory" NOT NULL,
    "type" "ResourceType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceDownload" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "downloadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceDownload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointTransaction" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscordActivity" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "activityType" "DiscordActivityType" NOT NULL,
    "xpDelta" INTEGER,
    "xpTotal" INTEGER,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscordActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BenchmarkSubmission_category_idx" ON "BenchmarkSubmission"("category");

-- CreateIndex
CREATE INDEX "BenchmarkSubmission_memberId_idx" ON "BenchmarkSubmission"("memberId");

-- CreateIndex
CREATE INDEX "BenchmarkSubmission_data_idx" ON "BenchmarkSubmission" USING GIN ("data" jsonb_path_ops);

-- CreateIndex
CREATE UNIQUE INDEX "BenchmarkSubmission_memberId_category_key" ON "BenchmarkSubmission"("memberId", "category");

-- CreateIndex
CREATE INDEX "Resource_category_idx" ON "Resource"("category");

-- CreateIndex
CREATE INDEX "Resource_type_idx" ON "Resource"("type");

-- CreateIndex
CREATE INDEX "Resource_isFeatured_idx" ON "Resource"("isFeatured");

-- CreateIndex
CREATE INDEX "ResourceDownload_memberId_idx" ON "ResourceDownload"("memberId");

-- CreateIndex
CREATE INDEX "ResourceDownload_resourceId_idx" ON "ResourceDownload"("resourceId");

-- CreateIndex
CREATE INDEX "ResourceDownload_downloadedAt_idx" ON "ResourceDownload"("downloadedAt");

-- CreateIndex
CREATE INDEX "PointTransaction_memberId_idx" ON "PointTransaction"("memberId");

-- CreateIndex
CREATE INDEX "PointTransaction_action_idx" ON "PointTransaction"("action");

-- CreateIndex
CREATE INDEX "PointTransaction_createdAt_idx" ON "PointTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "DiscordActivity_memberId_idx" ON "DiscordActivity"("memberId");

-- CreateIndex
CREATE INDEX "DiscordActivity_discordId_idx" ON "DiscordActivity"("discordId");

-- CreateIndex
CREATE INDEX "DiscordActivity_syncedAt_idx" ON "DiscordActivity"("syncedAt");

-- CreateIndex
CREATE INDEX "Member_totalPoints_idx" ON "Member"("totalPoints" DESC);

-- AddForeignKey
ALTER TABLE "BenchmarkSubmission" ADD CONSTRAINT "BenchmarkSubmission_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceDownload" ADD CONSTRAINT "ResourceDownload_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceDownload" ADD CONSTRAINT "ResourceDownload_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscordActivity" ADD CONSTRAINT "DiscordActivity_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
