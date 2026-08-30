import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { CompaniesService } from '../companies/companies.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

const STORAGE_ROOT = path.resolve(process.env.LOCAL_STORAGE_DIR || './storage');
const RESUME_DIR = path.join(STORAGE_ROOT, 'resumes');
const LOGO_DIR = path.join(STORAGE_ROOT, 'logos');
const AVATAR_DIR = path.join(STORAGE_ROOT, 'avatars');
const VIDEO_DIR = path.join(STORAGE_ROOT, 'videos');
const BLOG_DIR = path.join(STORAGE_ROOT, 'blog');
const CHAT_DIR = path.join(STORAGE_ROOT, 'chat');
for (const dir of [RESUME_DIR, LOGO_DIR, AVATAR_DIR, VIDEO_DIR, BLOG_DIR, CHAT_DIR]) fs.mkdirSync(dir, { recursive: true });

// Exported so cv.controller.ts's parse-only upload endpoint reuses the same
// allow-list instead of duplicating it.
export const RESUME_TYPES = new Set(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm']);
const CHAT_ATTACHMENT_TYPES = new Set([...IMAGE_TYPES, ...RESUME_TYPES]);

function safeName(originalname: string) {
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(originalname).toLowerCase()}`;
}

@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UploadsController {
  constructor(
    private prisma: PrismaService,
    private companies: CompaniesService,
  ) {}

  @Post('resume')
  @Roles('JOB_SEEKER')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: RESUME_DIR,
        filename: (_req, file, cb) => cb(null, safeName(file.originalname)),
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => cb(null, RESUME_TYPES.has(file.mimetype)),
    }),
  )
  async uploadResume(@CurrentUser() user: JwtUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Attach a PDF or Word document under 5MB');
    const resumeFileUrl = `/uploads/resumes/${file.filename}`;
    await this.prisma.seekerProfile.upsert({
      where: { userId: user.sub },
      update: { resumeFileUrl, resumeFileName: file.originalname },
      create: { userId: user.sub, resumeFileUrl, resumeFileName: file.originalname },
    });
    return { resumeFileUrl, resumeFileName: file.originalname };
  }

  @Post('company-logo')
  @Roles('COMPANY')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: LOGO_DIR,
        filename: (_req, file, cb) => cb(null, safeName(file.originalname)),
      }),
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => cb(null, IMAGE_TYPES.has(file.mimetype)),
    }),
  )
  async uploadLogo(@CurrentUser() user: JwtUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Attach a PNG, JPEG or WebP image under 2MB');
    const company = await this.companies.myCompany(user.sub);
    const logoUrl = `/uploads/logos/${file.filename}`;
    await this.companies.update(company.id, user.sub, { logoUrl });
    return { logoUrl };
  }

  @Post('avatar')
  @Roles('JOB_SEEKER')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: AVATAR_DIR,
        filename: (_req, file, cb) => cb(null, safeName(file.originalname)),
      }),
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => cb(null, IMAGE_TYPES.has(file.mimetype)),
    }),
  )
  async uploadAvatar(@CurrentUser() user: JwtUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Attach a PNG, JPEG or WebP image under 2MB');
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    await this.prisma.seekerProfile.upsert({
      where: { userId: user.sub },
      update: { avatarUrl },
      create: { userId: user.sub, avatarUrl },
    });
    return { avatarUrl };
  }

  @Post('video-resume')
  @Roles('JOB_SEEKER')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: VIDEO_DIR,
        filename: (_req, file, cb) => cb(null, safeName(file.originalname)),
      }),
      limits: { fileSize: 50 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => cb(null, VIDEO_TYPES.has(file.mimetype)),
    }),
  )
  async uploadVideoResume(@CurrentUser() user: JwtUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Attach an MP4 or WebM video under 50MB');
    const videoResumeUrl = `/uploads/videos/${file.filename}`;
    await this.prisma.seekerProfile.upsert({
      where: { userId: user.sub },
      update: { videoResumeUrl },
      create: { userId: user.sub, videoResumeUrl },
    });
    return { videoResumeUrl };
  }

  // Unlike the other upload endpoints, there's no existing row to persist
  // onto here — a new blog post doesn't exist yet at upload time. The admin
  // editor holds the returned URL in local state and includes it in the
  // subsequent create/update call instead.
  @Post('blog-cover')
  @Roles('ADMIN')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: BLOG_DIR,
        filename: (_req, file, cb) => cb(null, safeName(file.originalname)),
      }),
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => cb(null, IMAGE_TYPES.has(file.mimetype)),
    }),
  )
  async uploadBlogCover(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Attach a PNG, JPEG or WebP image under 2MB');
    return { coverImageUrl: `/uploads/blog/${file.filename}` };
  }

  // Both roles can attach a file to a chat message — unlike every other
  // upload endpoint here, there's no profile/company row to persist onto;
  // the URL is just embedded directly in the message (see
  // chat.controller.ts#send / chat.gateway.ts#sendMessage).
  @Post('chat-attachment')
  @Roles('JOB_SEEKER', 'COMPANY')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: CHAT_DIR,
        filename: (_req, file, cb) => cb(null, safeName(file.originalname)),
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => cb(null, CHAT_ATTACHMENT_TYPES.has(file.mimetype)),
    }),
  )
  async uploadChatAttachment(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Attach an image, PDF or Word document under 10MB');
    return {
      url: `/uploads/chat/${file.filename}`,
      type: IMAGE_TYPES.has(file.mimetype) ? 'image' : 'file',
      name: file.originalname,
    };
  }
}
