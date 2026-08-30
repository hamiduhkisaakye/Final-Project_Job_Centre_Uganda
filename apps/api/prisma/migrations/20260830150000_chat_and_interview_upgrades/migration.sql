-- Note: deliberately NOT dropping "Job_embedding_idx" / "SeekerProfile_embedding_idx"
-- here even though `prisma migrate diff` proposed it — these are pgvector ANN
-- indexes not expressible in schema.prisma, and the drift detector always
-- wants to drop them. See earlier migrations this session for the same note.

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED');

-- AlterEnum
ALTER TYPE "InterviewStatus" ADD VALUE 'PROPOSED';

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "blockedByCompany" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "blockedBySeeker" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "starredByCompany" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "starredBySeeker" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Interview" ALTER COLUMN "scheduledAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "attachmentName" TEXT,
ADD COLUMN     "attachmentType" TEXT,
ADD COLUMN     "attachmentUrl" TEXT;

-- CreateTable
CREATE TABLE "ConversationReport" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "ConversationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewSlot" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConversationReport_status_idx" ON "ConversationReport"("status");

-- CreateIndex
CREATE INDEX "InterviewSlot_interviewId_idx" ON "InterviewSlot"("interviewId");

-- AddForeignKey
ALTER TABLE "ConversationReport" ADD CONSTRAINT "ConversationReport_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationReport" ADD CONSTRAINT "ConversationReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationReport" ADD CONSTRAINT "ConversationReport_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSlot" ADD CONSTRAINT "InterviewSlot_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
