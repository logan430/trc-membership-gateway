-- CreateTable
CREATE TABLE IF NOT EXISTS "PointConfig" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "PointConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PointConfig_action_key" ON "PointConfig"("action");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PointConfig_action_idx" ON "PointConfig"("action");
