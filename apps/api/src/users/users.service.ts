import { Injectable, NotFoundException } from '@nestjs/common';
import { UserStatus, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingsService } from '../matching/embeddings.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private embeddings: EmbeddingsService,
  ) {}

  async list(role?: 'ADMIN' | 'COMPANY' | 'JOB_SEEKER') {
    return this.prisma.user.findMany({
      where: role ? { role } : undefined,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, email: true, phone: true, role: true, status: true,
        createdAt: true, lastLoginAt: true,
        seekerProfile: { select: { headline: true } },
        companyMemberships: { include: { company: { select: { name: true, slug: true } } } },
      },
    });
  }

  async setStatus(id: string, status: UserStatus) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({ where: { id }, data: { status } });
  }

  async listCompanies(status?: VerificationStatus) {
    return this.prisma.company.findMany({
      where: status ? { verificationStatus: status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { jobs: true } } },
    });
  }

  async setCompanyVerification(id: string, status: VerificationStatus) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException('Company not found');
    return this.prisma.company.update({ where: { id }, data: { verificationStatus: status } });
  }

  // Generates embeddings for every published job / seeker profile that
  // doesn't have one yet — for seed data, or after OPENAI_API_KEY is added
  // to an already-running instance. Safe to call repeatedly (skips rows
  // that already have an embedding).
  async backfillEmbeddings() {
    if (!this.embeddings.enabled) {
      return { ran: false, reason: 'OPENAI_API_KEY is not set' };
    }
    const jobs = await this.prisma.$queryRawUnsafe<{ id: string; title: string; description: string; category: string; location: string; skills: unknown }[]>(
      `SELECT id, title, description, category, location, skills FROM "Job" WHERE status = 'PUBLISHED' AND embedding IS NULL`,
    );
    for (const job of jobs) {
      await this.embeddings.embedAndStoreJob(job.id, job).catch(() => undefined);
    }

    const profiles = await this.prisma.$queryRawUnsafe<
      { userId: string; headline: string | null; about: string | null; location: string | null; skills: unknown; resumeText: string | null }[]
    >(`SELECT "userId", headline, about, location, skills, "resumeText" FROM "SeekerProfile" WHERE embedding IS NULL`);
    for (const profile of profiles) {
      await this.embeddings.embedAndStoreSeekerProfile(profile.userId, profile).catch(() => undefined);
    }

    return { ran: true, jobsEmbedded: jobs.length, profilesEmbedded: profiles.length };
  }
}
