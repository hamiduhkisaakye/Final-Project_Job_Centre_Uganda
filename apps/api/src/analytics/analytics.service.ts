import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompaniesService } from '../companies/companies.service';

interface DayCount {
  day: Date;
  count: bigint;
}

interface DayCountBy extends DayCount {
  label: string;
}

function toDateSeries(rows: DayCount[]) {
  return rows.map((r) => ({ date: r.day.toISOString().slice(0, 10), count: Number(r.count) }));
}

function toDateSeriesBy(rows: DayCountBy[], key: string) {
  return rows.map((r) => ({ date: r.day.toISOString().slice(0, 10), [key]: r.label, count: Number(r.count) }));
}

@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    private companies: CompaniesService,
  ) {}

  // Note: Job.viewsCount is a bare incrementing counter with no per-event
  // timestamp, so a true "views over time" trend isn't derivable without a
  // new page-view event log — deliberately out of scope here (would add a
  // write on every job view). topJobs (by the counters we do have) covers
  // the useful case without that cost.
  async forCompany(userId: string) {
    const company = await this.companies.myCompany(userId);

    const [applicationsOverTime, funnelRaw, topJobs] = await Promise.all([
      this.prisma.$queryRaw<DayCount[]>`
        SELECT date_trunc('day', a."submittedAt") AS day, COUNT(*)::bigint AS count
        FROM "Application" a
        JOIN "Job" j ON j.id = a."jobId"
        WHERE j."companyId" = ${company.id} AND a."submittedAt" >= NOW() - INTERVAL '30 days'
        GROUP BY day ORDER BY day ASC
      `,
      this.prisma.application.groupBy({
        by: ['stage'],
        where: { job: { companyId: company.id } },
        _count: true,
      }),
      this.prisma.job.findMany({
        where: { companyId: company.id },
        orderBy: { viewsCount: 'desc' },
        take: 5,
        select: { id: true, title: true, viewsCount: true, applicationsCount: true },
      }),
    ]);

    return {
      applicationsOverTime: toDateSeries(applicationsOverTime),
      funnel: funnelRaw.map((f) => ({ stage: f.stage, count: f._count })),
      topJobs,
    };
  }

  async forAdmin() {
    const [usersOverTime, jobsOverTime, applicationsOverTime, moderationThroughput] = await Promise.all([
      this.prisma.$queryRaw<DayCountBy[]>`
        SELECT date_trunc('day', "createdAt") AS day, role AS label, COUNT(*)::bigint AS count
        FROM "User"
        WHERE "createdAt" >= NOW() - INTERVAL '30 days'
        GROUP BY day, role ORDER BY day ASC
      `,
      this.prisma.$queryRaw<DayCount[]>`
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS count
        FROM "Job"
        WHERE "createdAt" >= NOW() - INTERVAL '30 days'
        GROUP BY day ORDER BY day ASC
      `,
      this.prisma.$queryRaw<DayCount[]>`
        SELECT date_trunc('day', "submittedAt") AS day, COUNT(*)::bigint AS count
        FROM "Application"
        WHERE "submittedAt" >= NOW() - INTERVAL '30 days'
        GROUP BY day ORDER BY day ASC
      `,
      this.prisma.$queryRaw<DayCountBy[]>`
        SELECT date_trunc('day', "decidedAt") AS day, decision::text AS label, COUNT(*)::bigint AS count
        FROM "ModerationQueue"
        WHERE "decidedAt" IS NOT NULL AND "decidedAt" >= NOW() - INTERVAL '30 days'
        GROUP BY day, decision ORDER BY day ASC
      `,
    ]);

    return {
      usersOverTime: toDateSeriesBy(usersOverTime, 'role'),
      jobsOverTime: toDateSeries(jobsOverTime),
      applicationsOverTime: toDateSeries(applicationsOverTime),
      moderationThroughput: toDateSeriesBy(moderationThroughput, 'decision'),
    };
  }
}
