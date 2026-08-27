import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Interview, InterviewMode, InterviewStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompaniesService } from '../companies/companies.service';
import { ChatService } from '../chat/chat.service';
import { ChatGateway } from '../chat/chat.gateway';
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

  async schedule(
    user: JwtUser,
    applicationId: string,
    dto: { scheduledAt: string; durationMinutes?: number; mode: InterviewMode; location?: string; notes?: string },
  ) {
    if (user.role !== 'COMPANY') throw new ForbiddenException('Only the hiring company can schedule interviews');
    const app = await this.assertApplicationAccess(applicationId, user);

    const interview = await this.prisma.interview.create({
      data: {
        applicationId,
        scheduledAt: new Date(dto.scheduledAt),
        durationMinutes: dto.durationMinutes ?? 30,
        mode: dto.mode,
        location: dto.location,
        notes: dto.notes,
        createdById: user.sub,
      },
    });

    // Auto-post into the existing per-job chat thread (Phase 2) so the
    // seeker sees the interview with full conversation context, not just
    // an isolated notification. Best-effort — scheduling still succeeds
    // if this fails for any reason.
    try {
      const conversation = await this.chat.startConversation(user, { seekerId: app.seekerId, jobId: app.jobId });
      const when = interview.scheduledAt.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
      const mode = interview.mode.replace('_', ' ').toLowerCase();
      const body = `📅 Interview scheduled for ${when} (${interview.durationMinutes} min, ${mode}).${interview.location ? ` ${interview.location}` : ''}`;
      const message = await this.chat.send(conversation.id, user.sub, body);
      this.chatGateway.broadcastMessage(conversation.id, message);
    } catch {
      /* non-critical */
    }

    return interview;
  }

  async list(user: JwtUser, applicationId: string) {
    await this.assertApplicationAccess(applicationId, user);
    return this.prisma.interview.findMany({ where: { applicationId }, orderBy: { scheduledAt: 'asc' } });
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
    if (user.role === 'JOB_SEEKER') {
      return this.prisma.interview.findMany({
        where: { application: { seekerId: user.sub } },
        orderBy: { scheduledAt: 'asc' },
        include: {
          application: {
            include: { job: { include: { company: { select: { id: true, name: true, slug: true, logoUrl: true } } } } },
          },
        },
      });
    }
    if (user.role === 'COMPANY') {
      const company = await this.companies.myCompany(user.sub);
      return this.prisma.interview.findMany({
        where: { application: { job: { companyId: company.id } } },
        orderBy: { scheduledAt: 'asc' },
        include: {
          application: {
            include: {
              seeker: { select: { id: true, email: true, seekerProfile: true } },
              job: { select: { id: true, title: true } },
            },
          },
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
    return this.buildIcs(interview as InterviewWithContext);
  }

  private buildIcs(interview: InterviewWithContext): string {
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
}
