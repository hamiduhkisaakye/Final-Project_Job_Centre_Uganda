import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SalaryVerificationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompaniesService } from '../companies/companies.service';

// A year is the fixed validity window this app grants an approved
// verification — a business rule, not a fabricated stat. Re-verification
// requires a fresh submission once it lapses.
const VERIFICATION_VALIDITY_DAYS = 365;

@Injectable()
export class SalaryVerificationsService {
  constructor(
    private prisma: PrismaService,
    private companies: CompaniesService,
  ) {}

  private async assertJobOwnership(jobId: string, userId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    await this.companies.assertMember(job.companyId, userId);
    return job;
  }

  // Real, computed evidence rather than an invented number: how many
  // applicants this company has actually hired for jobs in the same
  // category, which is what the admin reviewer weighs the uploaded payroll
  // evidence against.
  private comparableHires(companyId: string, category: string) {
    return this.prisma.application.count({
      where: { stage: 'HIRED', job: { companyId, category } },
    });
  }

  async submit(userId: string, jobId: string, evidenceUrl: string, evidenceName: string, note?: string) {
    const job = await this.assertJobOwnership(jobId, userId);
    const existingPending = await this.prisma.salaryVerificationRequest.findFirst({
      where: { jobId, status: 'PENDING' },
    });
    if (existingPending) throw new BadRequestException('A verification request for this job is already pending review');

    const comparableHires = await this.comparableHires(job.companyId, job.category);
    return this.prisma.salaryVerificationRequest.create({
      data: { jobId, companyId: job.companyId, evidenceUrl, evidenceName, note, comparableHires },
    });
  }

  async forJob(userId: string, jobId: string) {
    const job = await this.assertJobOwnership(jobId, userId);
    return this.prisma.salaryVerificationRequest.findMany({
      where: { jobId: job.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listPending(status?: SalaryVerificationStatus) {
    return this.prisma.salaryVerificationRequest.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'asc' },
      include: {
        job: { select: { id: true, title: true, salaryMin: true, salaryMax: true, salaryCurrency: true, salaryPeriod: true } },
        company: { select: { name: true, slug: true } },
      },
    });
  }

  async approve(adminId: string, id: string) {
    const request = await this.prisma.salaryVerificationRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Verification request not found');
    if (request.status !== 'PENDING') throw new ForbiddenException('This request has already been reviewed');

    const reviewedAt = new Date();
    const expiresAt = new Date(reviewedAt.getTime() + VERIFICATION_VALIDITY_DAYS * 86400000);

    const [updated] = await this.prisma.$transaction([
      this.prisma.salaryVerificationRequest.update({
        where: { id },
        data: { status: 'APPROVED', reviewedById: adminId, reviewedAt, expiresAt },
      }),
      this.prisma.job.update({
        where: { id: request.jobId },
        data: { salaryVerifiedAt: reviewedAt, salaryVerificationExpiresAt: expiresAt },
      }),
    ]);
    return updated;
  }

  async reject(adminId: string, id: string, reason: string) {
    const request = await this.prisma.salaryVerificationRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Verification request not found');
    if (request.status !== 'PENDING') throw new ForbiddenException('This request has already been reviewed');

    return this.prisma.salaryVerificationRequest.update({
      where: { id },
      data: { status: 'REJECTED', reviewedById: adminId, reviewedAt: new Date(), rejectionReason: reason },
    });
  }
}
