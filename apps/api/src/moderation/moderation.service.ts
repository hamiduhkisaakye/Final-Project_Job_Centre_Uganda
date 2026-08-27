import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ModerationService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async queue(decision: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ESCALATED' = 'PENDING') {
    const entries = await this.prisma.moderationQueue.findMany({
      where: { decision },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    // Hydrate with the entity being moderated (job or company). Phase 1
    // only ever queues jobs, but the shape supports company verification
    // requests too (Blueprint §10.2/§10.3) without a schema change.
    const jobIds = entries.filter((e) => e.entityType === 'JOB').map((e) => e.entityId);
    const companyIds = entries.filter((e) => e.entityType === 'COMPANY').map((e) => e.entityId);
    const [jobs, companies] = await Promise.all([
      this.prisma.job.findMany({ where: { id: { in: jobIds } }, include: { company: true } }),
      this.prisma.company.findMany({ where: { id: { in: companyIds } } }),
    ]);
    const jobMap = new Map(jobs.map((j) => [j.id, j]));
    const companyMap = new Map(companies.map((c) => [c.id, c]));

    return entries.map((e) => ({
      ...e,
      job: e.entityType === 'JOB' ? jobMap.get(e.entityId) : undefined,
      company: e.entityType === 'COMPANY' ? companyMap.get(e.entityId) : undefined,
    }));
  }

  async decide(adminId: string, id: string, decision: 'APPROVED' | 'REJECTED' | 'ESCALATED', note?: string) {
    const entry = await this.prisma.moderationQueue.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Moderation entry not found');
    if (entry.decision !== 'PENDING') throw new BadRequestException('This item has already been decided');

    let companyId: string | undefined;
    let subject = 'your listing';
    if (entry.entityType === 'JOB') {
      const job = await this.prisma.job.findUnique({ where: { id: entry.entityId }, select: { companyId: true, title: true } });
      companyId = job?.companyId;
      if (job) subject = `your job posting "${job.title}"`;
    } else if (entry.entityType === 'COMPANY') {
      companyId = entry.entityId;
      subject = 'your company profile';
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.moderationQueue.update({
        where: { id },
        data: { decision, decidedById: adminId, decidedAt: new Date(), note },
      });

      if (entry.entityType === 'JOB' && decision !== 'ESCALATED') {
        await tx.job.update({
          where: { id: entry.entityId },
          data:
            decision === 'APPROVED'
              ? { status: 'PUBLISHED', publishedAt: new Date() }
              : { status: 'REJECTED' },
        });
      }
      if (entry.entityType === 'COMPANY' && decision !== 'ESCALATED') {
        await tx.company.update({
          where: { id: entry.entityId },
          data: { verificationStatus: decision === 'APPROVED' ? 'VERIFIED' : 'REJECTED' },
        });
      }
    });

    if (companyId) {
      try {
        const verb = decision === 'APPROVED' ? 'approved' : decision === 'REJECTED' ? 'rejected' : 'escalated for further review';
        await this.notifications.notifyCompany(
          companyId,
          'JOB_MODERATION',
          'Moderation decision',
          `${subject[0].toUpperCase()}${subject.slice(1)} has been ${verb}.`,
          entry.entityType === 'JOB' ? '/company/manage-jobs' : '/company/settings',
        );
      } catch {
        /* non-critical */
      }
    }

    return { success: true };
  }
}
