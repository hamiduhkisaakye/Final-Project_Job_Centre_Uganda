-- Note: deliberately NOT dropping "Job_embedding_idx" / "SeekerProfile_embedding_idx"
-- here even though `prisma migrate diff` proposed it — these are pgvector ANN
-- indexes not expressible in schema.prisma, and the drift detector always
-- wants to drop them. See earlier migrations this session for the same note.

-- CreateEnum
CREATE TYPE "BlogCategory" AS ENUM ('CV_RESUME', 'INTERVIEWS', 'SALARY_NEGOTIATION', 'CAREER_GROWTH', 'WORKPLACE_TIPS');

-- AlterTable
ALTER TABLE "BlogPost" ADD COLUMN     "category" "BlogCategory" NOT NULL DEFAULT 'CAREER_GROWTH';

-- CreateIndex
CREATE INDEX "BlogPost_status_category_publishedAt_idx" ON "BlogPost"("status", "category", "publishedAt");
