BEGIN;
-- AlterTable
ALTER TABLE "FarmMember" ADD COLUMN     "careReminderEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reminderVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ReminderDelivery" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payloadJson" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseUntil" TIMESTAMP(3),
    "leaseToken" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReminderDelivery_createdAt_idx" ON "ReminderDelivery"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderDelivery_memberId_day_key" ON "ReminderDelivery"("memberId", "day");

-- AddForeignKey
ALTER TABLE "ReminderDelivery" ADD CONSTRAINT "ReminderDelivery_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FarmMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReminderDelivery" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "ReminderDelivery" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "ReminderDelivery" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "ReminderDelivery" FROM authenticated;
  END IF;
END $$;
CREATE POLICY reinwell_server_only ON "ReminderDelivery" FOR ALL TO postgres USING (true) WITH CHECK (true);
COMMIT;
