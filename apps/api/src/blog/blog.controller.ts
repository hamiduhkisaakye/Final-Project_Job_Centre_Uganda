import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { BlogCategory } from '@prisma/client';
import { BlogService } from './blog.service';
import { BlogAiService, EnhanceBlogPostInput } from './blog-ai.service';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto';
import { EnhanceBlogPostDto } from './dto/enhance-blog-post.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

@Controller()
export class BlogController {
  constructor(
    private blog: BlogService,
    private blogAi: BlogAiService,
  ) {}

  // Public — no guard.
  @Get('blog')
  listPublished(@Query('take') take?: string, @Query('category') category?: BlogCategory, @Query('q') q?: string) {
    const parsed = take ? Number(take) : undefined;
    return this.blog.listPublished(parsed && parsed > 0 ? parsed : undefined, category, q);
  }

  @Get('blog/:slug')
  getPublishedBySlug(@Param('slug') slug: string) {
    return this.blog.getPublishedBySlug(slug);
  }

  @Get('blog/:slug/adjacent')
  adjacent(@Param('slug') slug: string) {
    return this.blog.adjacent(slug);
  }

  @Get('blog/:slug/related')
  related(@Param('slug') slug: string) {
    return this.blog.related(slug);
  }

  // Admin-only from here down.
  @Get('admin/blog')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  listAllForAdmin() {
    return this.blog.listAllForAdmin();
  }

  @Get('admin/blog/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  getByIdForAdmin(@Param('id') id: string) {
    return this.blog.getByIdForAdmin(id);
  }

  @Post('admin/blog')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateBlogPostDto) {
    return this.blog.create(user.sub, dto);
  }

  @Patch('admin/blog/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateBlogPostDto) {
    return this.blog.update(id, dto);
  }

  @Post('admin/blog/:id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  publish(@Param('id') id: string) {
    return this.blog.publish(id);
  }

  @Post('admin/blog/:id/unpublish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  unpublish(@Param('id') id: string) {
    return this.blog.unpublish(id);
  }

  @Delete('admin/blog/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.blog.remove(id);
  }

  // Stateless — takes the current draft (saved or not) and returns a
  // suggested rewrite for the admin to review, never writes to the DB
  // itself.
  @Post('admin/blog/enhance')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  enhance(@Body() dto: EnhanceBlogPostDto): Promise<EnhanceBlogPostInput> {
    return this.blogAi.enhance(dto);
  }
}
