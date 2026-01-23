-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."AdminRole" AS ENUM ('ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "public"."SeatTier" AS ENUM ('INDIVIDUAL', 'OWNER', 'TEAM_MEMBER');

-- CreateEnum
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('NONE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED');

-- CreateTable
CREATE TABLE "public"."Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "public"."AdminRole" NOT NULL DEFAULT 'ADMIN',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmailTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Member" (
    "id" TEXT NOT NULL,
    "discordId" TEXT,
    "discordUsername" TEXT,
    "discordAvatar" TEXT,
    "stripeCustomerId" TEXT,
    "email" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "company" TEXT,
    "jobTitle" TEXT,
    "linkedInUrl" TEXT,
    "referralSource" TEXT,
    "subscriptionStatus" "public"."SubscriptionStatus" NOT NULL DEFAULT 'NONE',
    "seatTier" "public"."SeatTier",
    "currentPeriodEnd" TIMESTAMP(3),
    "introCompleted" BOOLEAN NOT NULL DEFAULT false,
    "introCompletedAt" TIMESTAMP(3),
    "introMessageId" TEXT,
    "teamId" TEXT,
    "isTeamAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "passwordHash" TEXT,
    "lastGuidanceDmAt" TIMESTAMP(3),
    "isPrimaryOwner" BOOLEAN NOT NULL DEFAULT false,
    "debtorStateEndsAt" TIMESTAMP(3),
    "gracePeriodEndsAt" TIMESTAMP(3),
    "isInDebtorState" BOOLEAN NOT NULL DEFAULT false,
    "paymentFailedAt" TIMESTAMP(3),
    "previousRole" TEXT,
    "sentBillingNotifications" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PendingInvite" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "seatTier" "public"."SeatTier" NOT NULL,
    "token" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "inviteeEmail" TEXT,

    CONSTRAINT "PendingInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReconciliationRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "membersChecked" INTEGER NOT NULL DEFAULT 0,
    "teamsChecked" INTEGER NOT NULL DEFAULT 0,
    "issuesFound" INTEGER NOT NULL DEFAULT 0,
    "issuesFixed" INTEGER NOT NULL DEFAULT 0,
    "autoFixEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isVerificationRun" BOOLEAN NOT NULL DEFAULT false,
    "triggeredBy" TEXT NOT NULL,
    "issues" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "ReconciliationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StripeEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB,

    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "subscriptionStatus" "public"."SubscriptionStatus" NOT NULL DEFAULT 'NONE',
    "ownerSeatCount" INTEGER NOT NULL DEFAULT 0,
    "teamSeatCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "debtorStateEndsAt" TIMESTAMP(3),
    "gracePeriodEndsAt" TIMESTAMP(3),
    "paymentFailedAt" TIMESTAMP(3),

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Admin_email_idx" ON "public"."Admin"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "public"."Admin"("email" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "public"."AuditLog"("action" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "public"."AuditLog"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "public"."AuditLog"("entityType" ASC, "entityId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_name_key" ON "public"."EmailTemplate"("name" ASC);

-- CreateIndex
CREATE INDEX "FeatureFlag_key_idx" ON "public"."FeatureFlag"("key" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "public"."FeatureFlag"("key" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Member_discordId_key" ON "public"."Member"("discordId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Member_email_key" ON "public"."Member"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Member_stripeCustomerId_key" ON "public"."Member"("stripeCustomerId" ASC);

-- CreateIndex
CREATE INDEX "Member_subscriptionStatus_idx" ON "public"."Member"("subscriptionStatus" ASC);

-- CreateIndex
CREATE INDEX "Member_teamId_idx" ON "public"."Member"("teamId" ASC);

-- CreateIndex
CREATE INDEX "PendingInvite_teamId_idx" ON "public"."PendingInvite"("teamId" ASC);

-- CreateIndex
CREATE INDEX "PendingInvite_token_idx" ON "public"."PendingInvite"("token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PendingInvite_token_key" ON "public"."PendingInvite"("token" ASC);

-- CreateIndex
CREATE INDEX "ReconciliationRun_startedAt_idx" ON "public"."ReconciliationRun"("startedAt" ASC);

-- CreateIndex
CREATE INDEX "StripeEvent_eventId_idx" ON "public"."StripeEvent"("eventId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "StripeEvent_eventId_key" ON "public"."StripeEvent"("eventId" ASC);

-- CreateIndex
CREATE INDEX "StripeEvent_processedAt_idx" ON "public"."StripeEvent"("processedAt" ASC);

-- CreateIndex
CREATE INDEX "StripeEvent_type_idx" ON "public"."StripeEvent"("type" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Team_stripeCustomerId_key" ON "public"."Team"("stripeCustomerId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Team_stripeSubscriptionId_key" ON "public"."Team"("stripeSubscriptionId" ASC);

-- AddForeignKey
ALTER TABLE "public"."Member" ADD CONSTRAINT "Member_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PendingInvite" ADD CONSTRAINT "PendingInvite_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

