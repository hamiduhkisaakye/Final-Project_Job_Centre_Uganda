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
  // Days since publishedAt — '1' | '7' | '30', matching the sidebar's
  // Posted within radio group.
  postedWithin?: string;
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
    const result = this.matching.score(
      {
        skills: (profile?.skills as string[]) || [],
        location: profile?.location,
        yearsExperience: profile?.yearsExperience,
        expectedSalaryMin: profile?.expectedSalaryMin,
        headline: profile?.headline,
        experience: (profile?.experience as { title?: string }[]) || [],
      },
      job,
      similarity,
    );
    const topPercent = await this.topPercentFor(jobId, result.score);
    return { ...result, topPercent };
  }

  // Below this many real applicants, a percentile is more misleading than
  // useful (e.g. "Top 100%" off a single data point) — omitted instead.
  private static readonly MIN_APPLICANTS_FOR_PERCENTILE = 3;

  // Ranks a score against other applicants' snapshotted matchScore for the
  // same job (Application.matchScore, set once at apply time — see
  // applications.service.ts#apply) rather than recomputing every
  // applicant's match live.
  private async topPercentFor(jobId: string, myScore: number): Promise<number | undefined> {
    const applications = await this.prisma.application.findMany({
      where: { jobId, matchScore: { not: null } },
      select: { matchScore: true },
    });
    if (applications.length < JobsService.MIN_APPLICANTS_FOR_PERCENTILE) return undefined;
    const above = applications.filter((a) => (a.matchScore as number) > myScore).length;
    return Math.min(99, Math.max(1, Math.round((above / applications.length) * 100)));
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
          headline: profile?.headline,
          experience: (profile?.experience as { title?: string }[]) || [],
        },
        job,
        similarities.get(job.id) ?? null,
      ),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  async search(query: JobSearchQuery) {
    // Default page size intentionally smaller than the old 12 — with a
    // small seed dataset, 12 was already the entire result set for most
    // searches, so "Load more" never had anything left to load even on the
    // plain, filter-less /jobs page.
    const take = Math.min(Number(query.take) || 6, 50);
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
    if (query.postedWithin) {
      const days = Number(query.postedWithin);
      if (days > 0) where.publishedAt = { gte: new Date(Date.now() - days * 86400000) };
    }

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
      include: {
        // Same "published jobs" count semantics as companies.service.ts's
        // list endpoint, so the job-detail company card and the companies
        // directory never disagree on what "N open jobs" means.
        company: { include: { _count: { select: { jobs: { where: { status: 'PUBLISHED' } } } } } },
        assessment: { select: { title: true, questions: true } },
      },
    });
    if (!job) throw new NotFoundException('Job not found');
    // Fire-and-forget view increment; not critical-path for the response.
    this.prisma.job.update({ where: { id: job.id }, data: { viewsCount: { increment: 1 } } }).catch(() => undefined);
    // The public job page needs the assessment's title and question count
    // (for the "includes a skill assessment" callout) but never the raw
    // questions JSON — that carries correctIndex answers, same reasoning as
    // assessments.service.ts#forSeeker stripping it for the seeker-facing
    // endpoint.
    const assessment = job.assessment
      ? { title: job.assessment.title, questionCount: (job.assessment.questions as unknown[]).length }
      : null;
    return { ...job, assessment };
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
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
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
    const data: Prisma.JobUpdateInput = { ...dto, expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined };
    const updated = await this.prisma.job.update({ where: { id }, data });
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
