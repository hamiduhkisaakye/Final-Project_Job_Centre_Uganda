-- CreateEnum
CREATE TYPE "SalaryVerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "screeningAnswers" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "requireVideoResume" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "salaryVerificationExpiresAt" TIMESTAMP(3),
ADD COLUMN     "screeningQuestions" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "SalaryVerificationRequest" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "evidenceUrl" TEXT NOT NULL,
    "evidenceName" TEXT NOT NULL,
    "note" TEXT,
    "comparableHires" INTEGER NOT NULL,
    "status" "SalaryVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryVerificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalaryVerificationRequest_status_idx" ON "SalaryVerificationRequest"("status");

-- CreateIndex
CREATE INDEX "SalaryVerificationRequest_jobId_idx" ON "SalaryVerificationRequest"("jobId");

-- AddForeignKey
ALTER TABLE "SalaryVerificationRequest" ADD CONSTRAINT "SalaryVerificationRequest_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryVerificationRequest" ADD CONSTRAINT "SalaryVerificationRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryVerificationRequest" ADD CONSTRAINT "SalaryVerificationRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
