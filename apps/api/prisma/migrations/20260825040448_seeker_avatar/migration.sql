-- AlterTable
ALTER TABLE "SeekerProfile" ADD COLUMN     "avatarUrl" TEXT;

-- Note: deliberately NOT dropping "Job_embedding_idx" / "SeekerProfile_embedding_idx"
-- here even though Prisma's diff proposed it — see the same note in earlier
-- migrations. They're the ANN indexes backing semantic match search and
-- aren't expressible in schema.prisma, so every diff against the live
-- schema will keep proposing to drop them.
