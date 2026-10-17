BEGIN;
-- AlterTable
ALTER TABLE "VetItem" ADD COLUMN     "assignedMemberId" TEXT;

-- CreateTable
CREATE TABLE "CareCompletion" (
    "id" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "careItemId" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemName" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "vetName" TEXT,
    "notes" TEXT,
    "completedByName" TEXT,
    "legacy" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CareCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CareCompletion_horseId_completedAt_idx" ON "CareCompletion"("horseId", "completedAt");

-- CreateIndex
CREATE INDEX "CareCompletion_careItemId_idx" ON "CareCompletion"("careItemId");

-- CreateIndex
CREATE INDEX "VetItem_assignedMemberId_idx" ON "VetItem"("assignedMemberId");

-- AddForeignKey
ALTER TABLE "VetItem" ADD CONSTRAINT "VetItem_assignedMemberId_fkey" FOREIGN KEY ("assignedMemberId") REFERENCES "FarmMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareCompletion" ADD CONSTRAINT "CareCompletion_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareCompletion" ADD CONSTRAINT "CareCompletion_careItemId_fkey" FOREIGN KEY ("careItemId") REFERENCES "VetItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Preserve the latest pre-history completion; earlier dates were never stored.
INSERT INTO "CareCompletion" ("id", "horseId", "careItemId", "completedAt", "itemName", "itemType", "vetName", "notes", "legacy")
SELECT 'legacy-' || "id", "horseId", "id", "lastDoneDate", "itemName", "itemType", "vetName", "notes", true
FROM "VetItem" WHERE "lastDoneDate" IS NOT NULL;

-- Reinwell accesses data through its server-side Prisma connection.
ALTER TABLE "CareCompletion" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "CareCompletion" FROM PUBLIC;
-- Supabase roles are absent in ordinary PostgreSQL test instances.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "CareCompletion" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "CareCompletion" FROM authenticated;
  END IF;
END $$;
CREATE POLICY reinwell_server_only ON "CareCompletion" FOR ALL TO postgres USING (true) WITH CHECK (true);
COMMIT;
