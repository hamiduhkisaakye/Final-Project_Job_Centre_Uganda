import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Real, live-computed numbers for the homepage stats bar — deliberately
// not cached/denormalized anywhere; at this app's scale a handful of
// COUNT queries on indexed columns is cheap, and "transparent, verified"
// is the whole brand premise, so these should never be able to drift from
// the truth the way a stored/periodically-refreshed counter could.
@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  async getPublicStats() {
    const [liveJobs, verifiedEmployers, candidatesHired, verifiedSalaryJobs] = await Promise.all([
      this.prisma.job.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.company.count({ where: { verificationStatus: 'VERIFIED' } }),
      this.prisma.application.count({ where: { stage: 'HIRED' } }),
      this.prisma.job.count({ where: { status: 'PUBLISHED', salaryVerifiedAt: { not: null } } }),
    ]);

    return {
      liveJobs,
      verifiedEmployers,
      candidatesHired,
      verifiedSalaryPercent: liveJobs > 0 ? Math.round((verifiedSalaryJobs / liveJobs) * 100) : 0,
    };
  }
}
