import { Injectable, NotFoundException } from '@nestjs/common';
import { BlogCategory, Prisma } from '@prisma/client';
import slugify from 'slugify';
import sanitizeHtml from 'sanitize-html';
import { PrismaService } from '../prisma/prisma.service';
import { BLOG_SANITIZE_OPTIONS } from './sanitize-options';

interface BlogPostInput {
  title: string;
  excerpt?: string;
  content: string;
  coverImageUrl?: string;
  category?: BlogCategory;
}

@Injectable()
export class BlogService {
  constructor(private prisma: PrismaService) {}

  async create(authorId: string, dto: BlogPostInput) {
    const slug = await this.uniqueSlug(dto.title);
    return this.prisma.blogPost.create({
      data: { ...dto, content: sanitizeHtml(dto.content, BLOG_SANITIZE_OPTIONS), slug, authorId },
    });
  }

  // Slug is set once here and never touched again by update() — keeps
  // public URLs stable even if the title is edited later (same rationale
  // as jobs.service.ts, which regenerates on create only).
  private async uniqueSlug(title: string): Promise<string> {
    const base = slugify(title, { lower: true, strict: true });
    let slug = base;
    let n = 1;
    while (await this.prisma.blogPost.findUnique({ where: { slug } })) {
      slug = `${base}-${++n}`;
    }
    return slug;
  }

  async update(id: string, dto: Partial<BlogPostInput>) {
    await this.getByIdForAdmin(id);
    return this.prisma.blogPost.update({
      where: { id },
      data: { ...dto, content: dto.content !== undefined ? sanitizeHtml(dto.content, BLOG_SANITIZE_OPTIONS) : undefined },
    });
  }

  async publish(id: string) {
    const post = await this.getByIdForAdmin(id);
    return this.prisma.blogPost.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: post.publishedAt ?? new Date() },
    });
  }

  async unpublish(id: string) {
    await this.getByIdForAdmin(id);
    return this.prisma.blogPost.update({ where: { id }, data: { status: 'DRAFT' } });
  }

  async remove(id: string) {
    await this.getByIdForAdmin(id);
    await this.prisma.blogPost.delete({ where: { id } });
    return { success: true };
  }

  listPublished(take = 20, category?: BlogCategory, q?: string) {
    const where: Prisma.BlogPostWhereInput = {
      status: 'PUBLISHED',
      ...(category ? { category } : {}),
      ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { excerpt: { contains: q, mode: 'insensitive' } }] } : {}),
    };
    return this.prisma.blogPost.findMany({ where, orderBy: { publishedAt: 'desc' }, take });
  }

  async getPublishedBySlug(slug: string) {
    const post = await this.prisma.blogPost.findUnique({ where: { slug } });
    if (!post || post.status !== 'PUBLISHED') throw new NotFoundException('Post not found');
    return post;
  }

  // Prefers other published posts in the same category; tops up with the
  // most recent other published posts if the category doesn't have enough
  // (e.g. a lightly-populated category, or the seed data's early days).
  async related(slug: string, take = 3) {
    const post = await this.getPublishedBySlug(slug);
    const sameCategory = await this.prisma.blogPost.findMany({
      where: { status: 'PUBLISHED', category: post.category, id: { not: post.id } },
      orderBy: { publishedAt: 'desc' },
      take,
    });
    if (sameCategory.length >= take) return sameCategory;

    const fillerIds = sameCategory.map((p) => p.id).concat(post.id);
    const filler = await this.prisma.blogPost.findMany({
      where: { status: 'PUBLISHED', id: { notIn: fillerIds } },
      orderBy: { publishedAt: 'desc' },
      take: take - sameCategory.length,
    });
    return [...sameCategory, ...filler];
  }

  // "Previous" = the closest post published before this one (older);
  // "next" = the closest post published after it (newer) — i.e. moving
  // forward in time, the same convention as flipping pages of a diary.
  async adjacent(slug: string) {
    const post = await this.getPublishedBySlug(slug);
    const select = { slug: true, title: true, coverImageUrl: true };
    const [previous, next] = await Promise.all([
      this.prisma.blogPost.findFirst({
        where: { status: 'PUBLISHED', publishedAt: { lt: post.publishedAt! } },
        orderBy: { publishedAt: 'desc' },
        select,
      }),
      this.prisma.blogPost.findFirst({
        where: { status: 'PUBLISHED', publishedAt: { gt: post.publishedAt! } },
        orderBy: { publishedAt: 'asc' },
        select,
      }),
    ]);
    return { previous, next };
  }

  listAllForAdmin() {
    return this.prisma.blogPost.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async getByIdForAdmin(id: string) {
    const post = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }
}
