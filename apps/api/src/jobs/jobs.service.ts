import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import slugify from 'slugify';
import { PrismaService } from '../prisma/prisma.service';
import { CompaniesService } from '../companies/companies.service';
import { MatchingService } from '../matching/matching.service';
import { EmbeddingsService } from '../matching/embeddings.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';

export interface JobSearchQuery {
  q?: string;
  location?: string;
  category?: string;
  type?: string;
  salaryMin?: string;
  verifiedSalary?: string;
  sort?: 'relevance' | 'newest' | 'salary_desc';
  cursor?: string;
  take?: string;
}

@Injectable()
export class JobsService {
  constructor(
    private prisma: PrismaService,
    private companies: CompaniesService,
    private matching: MatchingService,
    private embeddings: EmbeddingsService,
  ) {}

  async matchFor(userId: string, jobId: string) {
    const [profile, job, similarity] = await Promise.all([
      this.prisma.seekerProfile.findUnique({ where: { userId } }),
      this.findById(jobId),
      this.embeddings.similarity(userId, jobId),
    ]);
    return this.matching.score(
      {
        skills: (profile?.skills as string[]) || [],
        location: profile?.location,
        yearsExperience: profile?.yearsExperience,
        expectedSalaryMin: profile?.expectedSalaryMin,
      },
      job,
      similarity,
    );
  }

  async recommendationsFor(userId: string, limit = 12) {
    const [profile, jobs, similarities] = await Promise.all([
      this.prisma.seekerProfile.findUnique({ where: { userId } }),
      this.prisma.job.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { publishedAt: 'desc' },
        take: 60,
        include: { company: { select: { name: true, slug: true, logoUrl: true } } },
      }),
      this.embeddings.similarityToAllJobs(userId),
    ]);
    const scored = jobs.map((job) => ({
      job,
      ...this.matching.score(
        {
          skills: (profile?.skills as string[]) || [],
          location: profile?.location,
          yearsExperience: profile?.yearsExperience,
          expectedSalaryMin: profile?.expectedSalaryMin,
          expectedSalaryMax: profile?.expectedSalaryMax,
        },
        job,
        similarities.get(job.id) ?? null,
      ),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  async search(query: JobSearchQuery) {
    const take = Math.min(Number(query.take) || 12, 50);
    const where: Prisma.JobWhereInput = { status: 'PUBLISHED' };

    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (query.location) where.location = { contains: query.location, mode: 'insensitive' };
    if (query.category) where.category = query.category;
    if (query.type) where.employmentType = query.type as any;
    if (query.salaryMin) where.salaryMax = { gte: Number(query.salaryMin) };
    if (query.verifiedSalary === 'true') where.salaryVerifiedAt = { not: null };

    const orderBy: Prisma.JobOrderByWithRelationInput =
      query.sort === 'newest' || !query.sort
        ? { publishedAt: 'desc' }
        : query.sort === 'salary_desc'
          ? { salaryMax: 'desc' }
          : { publishedAt: 'desc' };

    const [items, total, facetCategories] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy,
        take,
        skip: query.cursor ? 1 : 0,
        cursor: query.cursor ? { id: query.cursor } : undefined,
        include: { company: { select: { name: true, slug: true, logoUrl: true, verificationStatus: true } } },
      }),
      this.prisma.job.count({ where }),
      this.prisma.job.groupBy({ by: ['category'], where: { status: 'PUBLISHED' }, _count: true }),
    ]);

    return {
      data: items,
      meta: {
        total,
        nextCursor: items.length === take ? items[items.length - 1].id : null,
        facets: { categories: facetCategories.map((f) => ({ category: f.category, count: f._count })) },
      },
    };
  }

  async findBySlug(slug: string) {
    const job = await this.prisma.job.findUnique({
      where: { slug },
      include: { company: true },
    });
    if (!job) throw new NotFoundException('Job not found');
    // Fire-and-forget view increment; not critical-path for the response.
    this.prisma.job.update({ where: { id: job.id }, data: { viewsCount: { increment: 1 } } }).catch(() => undefined);
    return job;
  }

  async findById(id: string) {
    const job = await this.prisma.job.findUnique({ where: { id }, include: { company: true } });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async myCompanyJobs(userId: string) {
    const company = await this.companies.myCompany(userId);
    return this.prisma.job.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  // A job's assessmentId must belong to the same company posting it —
  // otherwise a company could gate applicants behind another company's
  // assessment (and its correctIndex answers, via the seeker-facing
  // endpoint's question text at least matching a quiz they didn't author).
  private async assertAssessmentOwnership(assessmentId: string | undefined, companyId: string) {
    if (!assessmentId) return;
    const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment || assessment.companyId !== companyId) {
      throw new BadRequestException('That assessment does not belong to your company');
    }
  }

  async create(userId: string, dto: CreateJobDto) {
    const company = await this.companies.myCompany(userId);
    if (company.verificationStatus !== 'VERIFIED' && company.verificationStatus !== 'PENDING') {
      throw new BadRequestException('Your company must be verified before posting jobs');
    }
    await this.assertAssessmentOwnership(dto.assessmentId, company.id);

    const baseSlug = slugify(`${dto.title}-${company.name}`, { lower: true, strict: true });
    let slug = baseSlug;
    let n = 1;
    while (await this.prisma.job.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${++n}`;
    }

    const created = await this.prisma.job.create({
      data: {
        ...dto,
        responsibilities: dto.responsibilities || [],
        requirements: dto.requirements || [],
        skills: dto.skills || [],
        companyId: company.id,
        slug,
        status: 'DRAFT',
      },
    });
    await this.embeddings.embedAndStoreJob(created.id, created).catch(() => undefined);
    return created;
  }

  async update(userId: string, id: string, dto: UpdateJobDto) {
    const job = await this.findById(id);
    await this.companies.assertMember(job.companyId, userId);
    if (!['DRAFT', 'REJECTED', 'PUBLISHED', 'PAUSED'].includes(job.status)) {
      throw new BadRequestException(`Cannot edit a job in status ${job.status}`);
    }
    await this.assertAssessmentOwnership(dto.assessmentId, job.companyId);
    const updated = await this.prisma.job.update({ where: { id }, data: dto as Prisma.JobUpdateInput });
    await this.embeddings.embedAndStoreJob(updated.id, updated).catch(() => undefined);
    return updated;
  }

  // Submitting for publish moves a DRAFT/REJECTED job into moderation —
  // it only goes live once an admin approves it (Blueprint §6.1, §10.3).
  async submitForReview(userId: string, id: string) {
    const job = await this.findById(id);
    await this.companies.assertMember(job.companyId, userId);
    if (!['DRAFT', 'REJECTED'].includes(job.status)) {
      throw new BadRequestException(`Job is already ${job.status.toLowerCase().replace('_', ' ')}`);
    }
    const updated = await this.prisma.job.update({ where: { id }, data: { status: 'PENDING_REVIEW' } });
    await this.prisma.moderationQueue.create({
      data: { entityType: 'JOB', entityId: id, autoFlags: this.autoFlags(job) },
    });
    return updated;
  }

  async setStatus(userId: string, id: string, status: 'PAUSED' | 'CLOSED' | 'PUBLISHED') {
    const job = await this.findById(id);
    await this.companies.assertMember(job.companyId, userId);
    if (status === 'PUBLISHED' && job.status !== 'PAUSED') {
      throw new BadRequestException('Only a paused job can be republished directly');
    }
    return this.prisma.job.update({ where: { id }, data: { status } });
  }

  private autoFlags(job: { salaryDisclosed: boolean; description: string }): string[] {
    const flags: string[] = [];
    if (!job.salaryDisclosed) flags.push('salary not disclosed');
    if (/whatsapp|telegram|\b0\d{9}\b/i.test(job.description)) flags.push('possible off-platform contact info');
    return flags;
  }
}
