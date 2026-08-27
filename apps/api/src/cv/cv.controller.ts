import { BadRequestException, Controller, Get, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { CvParserService } from './cv-parser.service';
import { CvPdfService } from './cv-pdf.service';
import { RESUME_TYPES } from '../uploads/uploads.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

@Controller('me/cv')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('JOB_SEEKER')
export class CvController {
  constructor(
    private cvParser: CvParserService,
    private cvPdf: CvPdfService,
  ) {}

  // Parse-only — memory storage, not disk. Nothing here is persisted; the
  // real resume file upload (POST /uploads/resume) is unaffected and keeps
  // storing the file to disk exactly as before.
  @Post('parse')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => cb(null, RESUME_TYPES.has(file.mimetype)),
    }),
  )
  async parse(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Attach a PDF or Word document under 5MB');
    return this.cvParser.parse(file);
  }

  @Get('pdf')
  async pdf(@CurrentUser() user: JwtUser, @Res() res: Response) {
    const buffer = await this.cvPdf.generateForUser(user.sub);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="JobCentreUganda-CV.pdf"');
    res.send(buffer);
  }
}
