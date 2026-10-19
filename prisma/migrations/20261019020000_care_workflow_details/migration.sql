BEGIN;
-- AlterTable
ALTER TABLE "FarmMember" ADD COLUMN     "careReminderHourUTC" INTEGER NOT NULL DEFAULT 13,
ADD COLUMN     "careReminderLeadDays" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "CareCompletion" ADD COLUMN     "completionNotes" TEXT,
ADD COLUMN     "costCents" INTEGER,
ADD COLUMN     "costCurrency" TEXT,
ADD COLUMN     "productUsed" TEXT;

ALTER TABLE "CareCompletion" ADD CONSTRAINT "CareCompletion_cost_check" CHECK (("costCents" IS NULL AND "costCurrency" IS NULL) OR ("costCents" IS NOT NULL AND "costCurrency" IS NOT NULL AND "costCents" BETWEEN 0 AND 999999999 AND "costCurrency" IN ('USD','EUR','GBP','CAD','AUD','NZD')));
ALTER TABLE "FarmMember" ADD CONSTRAINT "FarmMember_reminder_preferences_check" CHECK ("careReminderLeadDays" IN (0,1,3,7) AND "careReminderHourUTC" IN (0,8,13,18));
COMMIT;
