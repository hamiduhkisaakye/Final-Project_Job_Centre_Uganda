import { Injectable, NotFoundException } from '@nestjs/common';
import slugify from 'slugify';
import sanitizeHtml from 'sanitize-html';
import { PrismaService } from '../prisma/prisma.service';
import { BLOG_SANITIZE_OPTIONS } from './sanitize-options';

interface BlogPostInput {
  title: string;
  excerpt?: string;
  content: string;
  coverImageUrl?: string;
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

  listPublished(take = 20) {
    return this.prisma.blogPost.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      take,
    });
  }

  async getPublishedBySlug(slug: string) {
    const post = await this.prisma.blogPost.findUnique({ where: { slug } });
    if (!post || post.status !== 'PUBLISHED') throw new NotFoundException('Post not found');
    return post;
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
