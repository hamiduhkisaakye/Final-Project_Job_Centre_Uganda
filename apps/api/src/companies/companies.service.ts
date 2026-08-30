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
        _count: { select: { follows: true, reviews: true } },
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    // A separate aggregate rather than folding into the include above —
    // Prisma's _count can't average a field, and this is one cheap indexed
    // query either way.
    const rating = await this.prisma.companyReview.aggregate({
      where: { companyId: company.id },
      _avg: { rating: true },
    });
    return { ...company, avgRating: rating._avg.rating != null ? Math.round(rating._avg.rating * 10) / 10 : null };
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
    website: string; about: string; hqLocation: string; foundedYear: number;
  }>) {
    const membership = await this.assertMember(companyId, userId);
    if (membership.memberRole === 'VIEWER') throw new ForbiddenException('Viewers cannot edit company branding');
    return this.prisma.company.update({ where: { id: companyId }, data });
  }

  async isFollowing(companyId: string, seekerId: string) {
    const row = await this.prisma.companyFollow.findUnique({
      where: { seekerId_companyId: { seekerId, companyId } },
    });
    return !!row;
  }

  async follow(companyId: string, seekerId: string) {
    await this.prisma.companyFollow.upsert({
      where: { seekerId_companyId: { seekerId, companyId } },
      update: {},
      create: { seekerId, companyId },
    });
    return { following: true };
  }

  async unfollow(companyId: string, seekerId: string) {
    await this.prisma.companyFollow.deleteMany({ where: { seekerId, companyId } });
    return { following: false };
  }

  async listReviews(companyId: string) {
    return this.prisma.companyReview.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      // Never the seeker's email here — reviews are public, unlike every
      // other place this shape is fetched.
      include: { seeker: { select: { seekerProfile: { select: { fullName: true, headline: true, avatarUrl: true } } } } },
    });
  }

  async myReview(companyId: string, seekerId: string) {
    return this.prisma.companyReview.findUnique({ where: { companyId_seekerId: { companyId, seekerId } } });
  }

  async upsertReview(companyId: string, seekerId: string, dto: { rating: number; comment?: string }) {
    return this.prisma.companyReview.upsert({
      where: { companyId_seekerId: { companyId, seekerId } },
      update: { rating: dto.rating, comment: dto.comment },
      create: { companyId, seekerId, rating: dto.rating, comment: dto.comment },
    });
  }

  async deleteReview(companyId: string, seekerId: string) {
    await this.prisma.companyReview.deleteMany({ where: { companyId, seekerId } });
    return { success: true };
  }

  // Only a member of the company being reviewed can respond — same
  // membership check every other company-scoped mutation in this service
  // uses. One response per review, editable in place (no history kept),
  // matching how a Google Business reply works.
  async respondToReview(companyId: string, reviewId: string, userId: string, response: string) {
    await this.assertMember(companyId, userId);
    const review = await this.prisma.companyReview.findUnique({ where: { id: reviewId } });
    if (!review || review.companyId !== companyId) throw new NotFoundException('Review not found');
    return this.prisma.companyReview.update({
      where: { id: reviewId },
      data: { response, respondedAt: new Date() },
    });
  }
}
