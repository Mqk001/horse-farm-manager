-- AlterTable
ALTER TABLE "User" ADD COLUMN     "googleSubject" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSubject_key" ON "User"("googleSubject");

