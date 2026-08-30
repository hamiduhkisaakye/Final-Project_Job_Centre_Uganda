-- Note: deliberately NOT dropping "Job_embedding_idx" / "SeekerProfile_embedding_idx"
-- here even though `prisma migrate diff` proposed it — these are pgvector ANN
-- indexes not expressible in schema.prisma, and the drift detector always
-- wants to drop them. See earlier migrations this session for the same note.

-- AlterTable
ALTER TABLE "SeekerProfile" ADD COLUMN     "certifications" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "education" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "experience" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "links" JSONB NOT NULL DEFAULT '[]';
