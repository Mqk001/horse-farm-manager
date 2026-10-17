-- CreateTable
CREATE TABLE "FarmTask" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "assignedMemberId" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FarmTask_farmId_completedAt_idx" ON "FarmTask"("farmId", "completedAt");

-- CreateIndex
CREATE INDEX "FarmTask_assignedMemberId_idx" ON "FarmTask"("assignedMemberId");

-- AddForeignKey
ALTER TABLE "FarmTask" ADD CONSTRAINT "FarmTask_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmTask" ADD CONSTRAINT "FarmTask_assignedMemberId_fkey" FOREIGN KEY ("assignedMemberId") REFERENCES "FarmMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Server-owned data: Reinwell authenticates and authorizes through its server.
ALTER TABLE "FarmTask" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "FarmTask" FROM anon, authenticated;
