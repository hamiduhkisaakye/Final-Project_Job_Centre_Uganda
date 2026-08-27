-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_jobId_fkey";

-- DropIndex
DROP INDEX "Conversation_companyId_seekerId_key";

-- AlterTable
ALTER TABLE "Conversation" ALTER COLUMN "jobId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_companyId_seekerId_jobId_key" ON "Conversation"("companyId", "seekerId", "jobId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Note: deliberately NOT dropping "Job_embedding_idx" / "SeekerProfile_embedding_idx"
-- here even though Prisma's diff proposed it — see the same note in the
-- phase2_chat_uploads_vector migration. They're the ANN indexes backing
-- semantic match search and aren't expressible in schema.prisma, so every
-- diff against the live schema will keep proposing to drop them.
