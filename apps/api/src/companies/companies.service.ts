import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  // Public company directory (/companies). Verified companies first, then
  // newest — a reasonable default with no real traffic data to rank by yet.
  // Sorted in JS rather than via Prisma orderBy because enum sort order
  // follows declaration order (UNVERIFIED, PENDING, VERIFIED, REJECTED),
  // which doesn't put VERIFIED first in either direction.
  async listPublic(q?: string) {
    const companies = await this.prisma.company.findMany({
      where: q ? { name: { contains: q, mode: 'insensitive' } } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { jobs: { where: { status: 'PUBLISHED' } } } } },
    });
    return companies.sort((a, b) => Number(b.verificationStatus === 'VERIFIED') - Number(a.verificationStatus === 'VERIFIED'));
  }

  async findBySlug(slug: string) {
    const company = await this.prisma.company.findUnique({
      where: { slug },
      include: {
        jobs: { where: { status: 'PUBLISHED' }, orderBy: { publishedAt: 'desc' } },
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async assertMember(companyId: string, userId: string) {
    const membership = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId } },
    });
    if (!membership) throw new ForbiddenException('You are not a member of this company');
    return membership;
  }

  async myCompany(userId: string) {
    const membership = await this.prisma.companyMember.findFirst({
      where: { userId },
      include: { company: true },
    });
    if (!membership) throw new NotFoundException('No company found for this account');
    return { ...membership.company, memberRole: membership.memberRole };
  }

  async update(companyId: string, userId: string, data: Partial<{
    name: string; logoUrl: string; coverUrl: string; industry: string; sizeBand: string;
    website: string; about: string; hqLocation: string;
  }>) {
    const membership = await this.assertMember(companyId, userId);
    if (membership.memberRole === 'VIEWER') throw new ForbiddenException('Viewers cannot edit company branding');
    return this.prisma.company.update({ where: { id: companyId }, data });
  }
}
