import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApplicationStage } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompaniesService } from '../companies/companies.service';
import { MatchingService } from '../matching/matching.service';
import { EmbeddingsService } from '../matching/embeddings.service';
import { ChatService } from '../chat/chat.service';
import { ChatGateway } from '../chat/chat.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { JwtUser } from '../auth/decorators/current-user.decorator';

// Stage moves a recruiter may make by dragging a card (Blueprint §9.4).
// WITHDRAWN is seeker-only (§8.3); REJECTED requires a reason.
const COMPANY_STAGES: ApplicationStage[] = ['APPLIED', 'IN_REVIEW', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'];

// Seeker-facing wording for the auto notification + auto chat message that
// fires on a stage move. Deliberately generic for REJECTED — the recruiter's
// typed reason (stored on Application.rejectionReason) is company-internal
// and must never be surfaced to the candidate here.
const STAGE_MESSAGES: Partial<Record<ApplicationStage, (jobTitle: string) => string>> = {
  IN_REVIEW: (t) => `Your application for ${t} has been moved to review.`,
  INTERVIEW: (t) => `Your application for ${t} has moved to the interview stage.`,
  OFFER: (t) => `Congratulations — you've received an offer for ${t}!`,
  HIRED: (t) => `You've been marked as hired for ${t}. Congratulations!`,
  REJECTED: (t) => `Your application for ${t} was not selected to move forward at this time.`,
};

@Injectable()
export class ApplicationsService {
  constructor(
    private prisma: PrismaService,
    private companies: CompaniesService,
    private matching: MatchingService,
    private embeddings: EmbeddingsService,
    private chat: ChatService,
    private chatGateway: ChatGateway,
    private notifications: NotificationsService,
  ) {}

  async apply(
    seekerId: string,
    jobId: string,
    coverLetter?: string,
    screeningAnswers?: { questionId: string; answer: string }[],
  ) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job || job.status !== 'PUBLISHED') throw new NotFoundException('This job is not accepting applications');

    const existing = await this.prisma.application.findUnique({
      where: { jobId_seekerId: { jobId, seekerId } },
    });
    if (existing) throw new ConflictException('You have already applied to this job');

    // If this job requires a skills assessment, the seeker must already
    // have a scored attempt for it — ApplyPanel routes them through
    // TakeAssessmentModal before letting them reach this endpoint, but the
    // check is enforced here too since the client-side gate is only UX.
    let assessmentScore: number | null = null;
    let assessmentPassed: boolean | null = null;
    if (job.assessmentId) {
      const attempt = await this.prisma.assessmentAttempt.findUnique({
        where: { assessmentId_seekerId: { assessmentId: job.assessmentId, seekerId } },
      });
      if (!attempt) throw new BadRequestException('Complete the required assessment before applying');
      assessmentScore = attempt.score;
      assessmentPassed = attempt.passed;
    }

    if (job.requireVideoResume) {
      const profile = await this.prisma.seekerProfile.findUnique({ where: { userId: seekerId } });
      if (!profile?.videoResumeUrl) throw new BadRequestException('This role requires a video resume — add one to your profile before applying');
    }

    // Every screening question must be answered; a knock-out question whose
    // answer doesn't match the required one blocks the application from
    // being created at all, same as the assessment gate above, so the
    // candidate finds out immediately rather than ending up silently
    // rejected later.
    const questions = (job.screeningQuestions as { id: string; text: string; type: string; knockout: boolean; requiredAnswer?: string }[]) || [];
    for (const q of questions) {
      const given = screeningAnswers?.find((a) => a.questionId === q.id);
      if (!given?.answer) throw new BadRequestException(`Answer the required question: ${q.text}`);
      if (q.knockout && given.answer !== q.requiredAnswer) {
        throw new BadRequestException(`This role requires: ${q.text} — ${q.requiredAnswer === 'YES' ? 'Yes' : 'No'}`);
      }
    }

    const [profile, similarity] = await Promise.all([
      this.prisma.seekerProfile.findUnique({ where: { userId: seekerId } }),
      this.embeddings.similarity(seekerId, jobId),
    ]);
    const { score } = this.matching.score(
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

    const application = await this.prisma.$transaction(async (tx) => {
      const app = await tx.application.create({
        data: { jobId, seekerId, coverLetter, matchScore: score, assessmentScore, assessmentPassed, screeningAnswers: screeningAnswers || [] },
      });
      await tx.applicationEvent.create({
        data: { applicationId: app.id, actorId: seekerId, type: 'CREATED', toStage: 'APPLIED' },
      });
      await tx.job.update({ where: { id: jobId }, data: { applicationsCount: { increment: 1 } } });
      return app;
    });

    try {
      await this.notifications.notifyCompany(
        job.companyId,
        'NEW_APPLICATION',
        'New application received',
        `A new application was submitted for ${job.title}.`,
        '/company/pipeline',
      );
    } catch {
      /* non-critical */
    }

    return application;
  }

  async mine(seekerId: string) {
    return this.prisma.application.findMany({
      where: { seekerId },
      // Explicitly reordered applications (priorityOrder set via #reorder)
      // sort first by that order; everything else falls back to newest
      // first, same as before this field existed.
      orderBy: [{ priorityOrder: { sort: 'asc', nulls: 'last' } }, { submittedAt: 'desc' }],
      include: { job: { include: { company: { select: { id: true, name: true, slug: true, logoUrl: true } } } } },
    });
  }

  // Seeker's own drag-to-reorder within a Kanban column — a personal
  // display preference only, scoped to applications that are both theirs
  // and still in the given stage (a stale drag from before the employer
  // moved the card is silently ignored rather than erroring).
  async reorder(seekerId: string, stage: ApplicationStage, orderedIds: string[]) {
    const apps = await this.prisma.application.findMany({
      where: { id: { in: orderedIds }, seekerId, stage },
      select: { id: true },
    });
    const validIds = new Set(apps.map((a) => a.id));
    const ordered = orderedIds.filter((id) => validIds.has(id));
    await this.prisma.$transaction(
      ordered.map((id, index) => this.prisma.application.update({ where: { id }, data: { priorityOrder: index } })),
    );
    return { success: true };
  }

  async forCompany(userId: string, jobId?: string) {
    const company = await this.companies.myCompany(userId);
    return this.prisma.application.findMany({
      where: { job: { companyId: company.id }, ...(jobId ? { jobId } : {}) },
      orderBy: { matchScore: 'desc' },
      include: {
        job: { select: { id: true, title: true } },
        seeker: { select: { id: true, email: true, seekerProfile: true } },
      },
    });
  }

  async findOne(id: string) {
    const app = await this.prisma.application.findUnique({
      where: { id },
      include: {
        job: { include: { company: true } },
        seeker: { select: { id: true, email: true, seekerProfile: true } },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  async companyMoveStage(userId: string, id: string, toStage: ApplicationStage, reason?: string) {
    if (!COMPANY_STAGES.includes(toStage)) throw new BadRequestException('Invalid stage');
    const app = await this.findOne(id);
    await this.companies.assertMember(app.job.companyId, userId);
    if (toStage === 'REJECTED' && !reason) throw new BadRequestException('A rejection reason is required');

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.application.update({
        where: { id },
        data: { stage: toStage, stageChangedAt: new Date(), rejectionReason: toStage === 'REJECTED' ? reason : app.rejectionReason },
      });
      await tx.applicationEvent.create({
        data: { applicationId: id, actorId: userId, type: 'STAGE_CHANGED', fromStage: app.stage, toStage, note: reason },
      });
      return u;
    });

    // Best-effort — seeker notification + a distinct-style auto chat
    // message, mirroring interviews.service.ts#schedule's pattern.
    try {
      const text = STAGE_MESSAGES[toStage]?.(app.job.title);
      if (text) {
        await this.notifications.create(app.seekerId, 'APPLICATION_STAGE', 'Application update', text, '/dashboard/applications');
        const conversation = await this.chat.startConversation(
          { sub: userId, role: 'COMPANY' } as JwtUser,
          { seekerId: app.seekerId, jobId: app.jobId },
        );
        const message = await this.chat.send(conversation.id, userId, text, true);
        this.chatGateway.broadcastMessage(conversation.id, message);
      }
    } catch {
      /* non-critical */
    }

    return updated;
  }

  async withdraw(seekerId: string, id: string) {
    const app = await this.findOne(id);
    if (app.seekerId !== seekerId) throw new ForbiddenException('This is not your application');
    if (app.stage === 'HIRED') throw new BadRequestException('This application has already resulted in a hire');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.application.update({
        where: { id },
        data: { stage: 'WITHDRAWN', stageChangedAt: new Date() },
      });
      await tx.applicationEvent.create({
        data: { applicationId: id, actorId: seekerId, type: 'STAGE_CHANGED', fromStage: app.stage, toStage: 'WITHDRAWN' },
      });
      return updated;
    });
  }
}
