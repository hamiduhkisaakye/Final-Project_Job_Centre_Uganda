import { Injectable, NotFoundException } from '@nestjs/common';
import slugify from 'slugify';
import { PrismaService } from '../prisma/prisma.service';

interface CategoryInput {
  name: string;
  icon: string;
  sortOrder?: number;
}

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CategoryInput) {
    const slug = await this.uniqueSlug(dto.name);
    return this.prisma.category.create({ data: { ...dto, slug } });
  }

  // Slug is set once here and never touched by update() — same rationale as
  // jobs.service.ts / blog.service.ts (keeps anything linking by slug stable
  // even if the name is edited later).
  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name, { lower: true, strict: true });
    let slug = base;
    let n = 1;
    while (await this.prisma.category.findUnique({ where: { slug } })) {
      slug = `${base}-${++n}`;
    }
    return slug;
  }

  async update(id: string, dto: Partial<CategoryInput>) {
    await this.getById(id);
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.getById(id);
    await this.prisma.category.delete({ where: { id } });
    return { success: true };
  }

  async getById(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  // The one list every caller uses — public homepage/browse-all page, the
  // admin list view, and the post-job/JobFilters dropdowns. Categories have
  // no private/draft state (unlike blog posts), so there's no need for a
  // separate admin-only listing.
  async listWithCounts() {
    const [categories, counts] = await Promise.all([
      this.prisma.category.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.prisma.job.groupBy({ by: ['category'], where: { status: 'PUBLISHED' }, _count: true }),
    ]);
    const countByName = new Map(counts.map((c) => [c.category, c._count]));
    return categories.map((c) => ({ ...c, jobCount: countByName.get(c.name) ?? 0 }));
  }
}
