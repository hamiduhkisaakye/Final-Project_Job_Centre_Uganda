-- AlterTable
ALTER TABLE "SeekerProfile" ADD COLUMN     "fullName" TEXT;

-- Note: Prisma's drift detector wanted to DROP INDEX "Job_embedding_idx" and
-- "SeekerProfile_embedding_idx" here, because ivfflat/vector_cosine_ops
-- indexes aren't expressible in schema.prisma and so look like unmanaged
-- drift. Deliberately not dropping them — they're the ANN indexes backing
-- semantic match search. Expect this same prompt on future `prisma migrate
-- dev` runs; strip the DROP INDEX lines again rather than letting them apply.
