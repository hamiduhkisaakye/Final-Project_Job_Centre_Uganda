import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Interview, InterviewMode, InterviewStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompaniesService } from '../companies/companies.service';
import { ChatService } from '../chat/chat.service';
import { ChatGateway } from '../chat/chat.gateway';
import { InterviewAiService } from './interview-ai.service';
import { JwtUser } from '../auth/decorators/current-user.decorator';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

// RFC 5545 UTC date-time (YYYYMMDDTHHMMSSZ).
function formatIcsDate(d: Date) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function escapeIcs(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
}

type InterviewWithContext = Interview & {
  application: { job: { title: string; company: { name: string } } };
};

@Injectable()
export class InterviewsService {
  constructor(
    private prisma: PrismaService,
    private companies: CompaniesService,
    private chat: ChatService,
    private chatGateway: ChatGateway,
    private interviewAi: InterviewAiService,
  ) {}

  private async assertApplicationAccess(applicationId: string, user: JwtUser) {
    const app = await this.prisma.application.findUnique({ where: { id: applicationId }, include: { job: true } });
    if (!app) throw new NotFoundException('Application not found');
    if (user.role === 'JOB_SEEKER') {
      if (app.seekerId !== user.sub) throw new ForbiddenException('This is not your application');
    } else if (user.role === 'COMPANY') {
      await this.companies.assertMember(app.job.companyId, user.sub);
    } else {
      throw new ForbiddenException('Not part of this application');
    }
    return app;
  }

  // Replaces the old single-fixed-time `schedule()` — a recruiter now
  // always offers one or more candidate times and the interview sits
  // PROPOSED until the seeker confirms one (see confirmSlot below). Even a
  // single offered time goes through this same accept step, matching the
  // "Interview Invitation… Accept / Suggest another time" chat card.
  async propose(
    user: JwtUser,
    applicationId: string,
    dto: { slots: string[]; durationMinutes?: number; mode: InterviewMode; location?: string; notes?: string },
  ) {
    if (user.role !== 'COMPANY') throw new ForbiddenException('Only the hiring company can schedule interviews');
    if (!dto.slots?.length) throw new BadRequestException('Offer at least one candidate time');
    const app = await this.assertApplicationAccess(applicationId, user);

    // A fresh proposal supersedes any still-unanswered one for this
    // application — otherwise a seeker who asked for another time (see
    // requestReschedule below) keeps seeing the old, now-stale proposal
    // sitting in "Needs your response" forever after the recruiter sends a
    // new one. Only PROPOSED (never-confirmed) interviews are cancelled
    // here — a already-CONFIRMED interview is left alone, since a company
    // may legitimately schedule a second round while a first is booked.
    await this.prisma.interview.updateMany({
      where: { applicationId, status: 'PROPOSED' },
      data: { status: 'CANCELLED' },
    });

    const interview = await this.prisma.interview.create({
      data: {
        applicationId,
        status: 'PROPOSED',
        durationMinutes: dto.durationMinutes ?? 30,
        mode: dto.mode,
        location: dto.location,
        notes: dto.notes,
        createdById: user.sub,
        slots: { create: dto.slots.map((s) => ({ startsAt: new Date(s) })) },
      },
      include: { slots: { orderBy: { startsAt: 'asc' } } },
    });

    // Auto-post into the existing per-job chat thread (Phase 2) so the
    // seeker sees the interview with full conversation context, not just
    // an isolated notification. Best-effort — proposing still succeeds if
    // this fails for any reason.
    try {
      const conversation = await this.chat.startConversation(user, { seekerId: app.seekerId, jobId: app.jobId });
      const mode = interview.mode.replace('_', ' ').toLowerCase();
      const times = interview.slots.map((s) => s.startsAt.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })).join(' · ');
      const body = `📅 Interview requested (${interview.durationMinutes} min, ${mode}). Proposed times: ${times}${interview.location ? ` — ${interview.location}` : ''}`;
      const message = await this.chat.send(conversation.id, user.sub, body);
      this.chatGateway.broadcastMessage(conversation.id, message);
    } catch {
      /* non-critical */
    }

    return interview;
  }

  // Seeker picks one of the recruiter's offered times — flips the
  // interview from PROPOSED to SCHEDULED and sets the confirmed time.
  async confirmSlot(user: JwtUser, interviewId: string, slotId: string) {
    if (user.role !== 'JOB_SEEKER') throw new ForbiddenException('Only the candidate can confirm a time');
    const interview = await this.prisma.interview.findUnique({
      where: { id: interviewId },
      include: { application: { include: { job: true } }, slots: true },
    });
    if (!interview) throw new NotFoundException('Interview not found');
    if (interview.application.seekerId !== user.sub) throw new ForbiddenException('Not your interview');
    if (interview.status !== 'PROPOSED') throw new BadRequestException('This interview is not awaiting confirmation');
    const slot = interview.slots.find((s) => s.id === slotId);
    if (!slot) throw new BadRequestException('That slot is not part of this interview');

    const updated = await this.prisma.interview.update({
      where: { id: interviewId },
      data: { status: 'SCHEDULED', scheduledAt: slot.startsAt },
    });

    try {
      const conversation = await this.chat.startConversation(user, {
        companyId: interview.application.job.companyId,
        jobId: interview.application.jobId,
      });
      const when = slot.startsAt.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
      const message = await this.chat.send(conversation.id, user.sub, `✅ Confirmed for ${when}. See you then!`);
      this.chatGateway.broadcastMessage(conversation.id, message);
    } catch {
      /* non-critical */
    }

    return updated;
  }

  // "Suggest another time" — no schema state change, just a chat nudge
  // back to the recruiter, who can propose() again with new times.
  async requestReschedule(user: JwtUser, interviewId: string, note?: string) {
    if (user.role !== 'JOB_SEEKER') throw new ForbiddenException('Only the candidate can request a different time');
    const interview = await this.prisma.interview.findUnique({
      where: { id: interviewId },
      include: { application: { include: { job: true } } },
    });
    if (!interview) throw new NotFoundException('Interview not found');
    if (interview.application.seekerId !== user.sub) throw new ForbiddenException('Not your interview');

    try {
      const conversation = await this.chat.startConversation(user, {
        companyId: interview.application.job.companyId,
        jobId: interview.application.jobId,
      });
      const body = `🔁 Could we find another time for the interview?${note ? ` ${note}` : ''}`;
      const message = await this.chat.send(conversation.id, user.sub, body);
      this.chatGateway.broadcastMessage(conversation.id, message);
    } catch {
      /* non-critical */
    }

    return { success: true };
  }

  // Lets the candidate cancel outright — a still-PROPOSED offer they don't
  // want any of, or an already-SCHEDULED one they can no longer make.
  // Unlike requestReschedule this is a real state change, so the recruiter
  // needs a clear signal, not just a nudge.
  async cancelBySeeker(user: JwtUser, interviewId: string) {
    if (user.role !== 'JOB_SEEKER') throw new ForbiddenException('Only the candidate can cancel their own interview');
    const interview = await this.prisma.interview.findUnique({
      where: { id: interviewId },
      include: { application: { include: { job: true } } },
    });
    if (!interview) throw new NotFoundException('Interview not found');
    if (interview.application.seekerId !== user.sub) throw new ForbiddenException('Not your interview');
    if (interview.status === 'CANCELLED' || interview.status === 'COMPLETED') {
      throw new BadRequestException(`This interview is already ${interview.status.toLowerCase()}`);
    }

    const updated = await this.prisma.interview.update({ where: { id: interviewId }, data: { status: 'CANCELLED' } });

    try {
      const conversation = await this.chat.startConversation(user, {
        companyId: interview.application.job.companyId,
        jobId: interview.application.jobId,
      });
      const message = await this.chat.send(conversation.id, user.sub, '❌ The candidate has cancelled this interview.');
      this.chatGateway.broadcastMessage(conversation.id, message);
    } catch {
      /* non-critical */
    }

    return updated;
  }

  async list(user: JwtUser, applicationId: string) {
    await this.assertApplicationAccess(applicationId, user);
    return this.prisma.interview.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
      include: { slots: { orderBy: { startsAt: 'asc' } } },
    });
  }

  async update(
    user: JwtUser,
    id: string,
    dto: Partial<{
      scheduledAt: string;
      durationMinutes: number;
      mode: InterviewMode;
      location: string;
      notes: string;
      status: InterviewStatus;
    }>,
  ) {
    const interview = await this.prisma.interview.findUnique({
      where: { id },
      include: { application: { include: { job: true } } },
    });
    if (!interview) throw new NotFoundException('Interview not found');
    await this.companies.assertMember(interview.application.job.companyId, user.sub);

    return this.prisma.interview.update({
      where: { id },
      data: {
        ...(dto.scheduledAt ? { scheduledAt: new Date(dto.scheduledAt) } : {}),
        ...(dto.durationMinutes != null ? { durationMinutes: dto.durationMinutes } : {}),
        ...(dto.mode ? { mode: dto.mode } : {}),
        ...(dto.location !== undefined ? { location: dto.location } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
    });
  }

  async myInterviews(user: JwtUser) {
    // Newest-first rather than by scheduledAt — a PROPOSED interview has
    // no scheduledAt yet (it's null until confirmed), so ordering by it
    // would bury pending-response interviews unpredictably among nulls.
    // The frontend buckets into "Needs your response"/"Upcoming"/"Past".
    if (user.role === 'JOB_SEEKER') {
      return this.prisma.interview.findMany({
        where: { application: { seekerId: user.sub } },
        orderBy: { createdAt: 'desc' },
        include: {
          application: {
            include: { job: { include: { company: { select: { id: true, name: true, slug: true, logoUrl: true } } } } },
          },
          slots: { orderBy: { startsAt: 'asc' } },
          // "Interviewer" for the prep panel — this app doesn't model named
          // interviewer assignment, so the person who scheduled it stands
          // in for "who to expect".
          createdBy: { select: { id: true, email: true } },
        },
      });
    }
    if (user.role === 'COMPANY') {
      const company = await this.companies.myCompany(user.sub);
      return this.prisma.interview.findMany({
        where: { application: { job: { companyId: company.id } } },
        orderBy: { createdAt: 'desc' },
        include: {
          application: {
            include: {
              seeker: { select: { id: true, email: true, seekerProfile: true } },
              job: { select: { id: true, title: true } },
            },
          },
          slots: { orderBy: { startsAt: 'asc' } },
        },
      });
    }
    return [];
  }

  async getIcs(id: string, user: JwtUser): Promise<string> {
    const interview = await this.prisma.interview.findUnique({
      where: { id },
      include: { application: { include: { job: { include: { company: true } } } } },
    });
    if (!interview) throw new NotFoundException('Interview not found');
    if (user.role === 'JOB_SEEKER' && interview.application.seekerId !== user.sub) {
      throw new ForbiddenException('Not part of this interview');
    }
    if (user.role === 'COMPANY') {
      await this.companies.assertMember(interview.application.job.companyId, user.sub);
    }
    if (!interview.scheduledAt) throw new BadRequestException('This interview time is not confirmed yet');
    return this.buildIcs(interview as InterviewWithContext & { scheduledAt: Date });
  }

  private buildIcs(interview: InterviewWithContext & { scheduledAt: Date }): string {
    const dtStart = formatIcsDate(interview.scheduledAt);
    const dtEnd = formatIcsDate(new Date(interview.scheduledAt.getTime() + interview.durationMinutes * 60000));
    const summary = `Interview: ${interview.application.job.title} at ${interview.application.job.company.name}`;
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Job Centre Uganda//Interview Scheduling//EN',
      'BEGIN:VEVENT',
      `UID:${interview.id}@jobcentre.ug`,
      `DTSTAMP:${formatIcsDate(new Date())}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${escapeIcs(summary)}`,
      `DESCRIPTION:${escapeIcs(interview.notes || '')}`,
      `LOCATION:${escapeIcs(interview.location || '')}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
  }

  // Prep panel's AI-suggested questions — the job description/skills/links
  // side of the panel is otherwise just data the frontend already has
  // (job.slug from this same interview, the seeker's own resume/video from
  // /auth/me), so this is the one piece that genuinely needs a server call.
  async prepQuestions(user: JwtUser, interviewId: string) {
    const interview = await this.prisma.interview.findUnique({
      where: { id: interviewId },
      include: { application: { include: { job: true } } },
    });
    if (!interview) throw new NotFoundException('Interview not found');
    if (interview.application.seekerId !== user.sub) throw new ForbiddenException('Not your interview');
    return this.interviewAi.likelyQuestions({
      title: interview.application.job.title,
      description: interview.application.job.description,
    });
  }
}
