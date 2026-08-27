import { Module } from '@nestjs/common';
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

class SaveJobDto {
  @IsString()
  jobId: string;

  @IsOptional()
  @IsString()
  folder?: string;
}

@Controller('saved-jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('JOB_SEEKER')
export class SavedJobsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.prisma.savedJob.findMany({
      where: { seekerId: user.sub },
      orderBy: { createdAt: 'desc' },
      include: { job: { include: { company: { select: { name: true, slug: true, logoUrl: true } } } } },
    });
  }

  @Post()
  save(@CurrentUser() user: JwtUser, @Body() dto: SaveJobDto) {
    return this.prisma.savedJob.upsert({
      where: { seekerId_jobId: { seekerId: user.sub, jobId: dto.jobId } },
      update: { folder: dto.folder },
      create: { seekerId: user.sub, jobId: dto.jobId, folder: dto.folder || 'Shortlist' },
    });
  }

  @Patch(':jobId')
  updateFolder(@CurrentUser() user: JwtUser, @Param('jobId') jobId: string, @Body() dto: SaveJobDto) {
    return this.prisma.savedJob.update({
      where: { seekerId_jobId: { seekerId: user.sub, jobId } },
      data: { folder: dto.folder },
    });
  }

  @Delete(':jobId')
  remove(@CurrentUser() user: JwtUser, @Param('jobId') jobId: string) {
    return this.prisma.savedJob.delete({ where: { seekerId_jobId: { seekerId: user.sub, jobId } } });
  }
}

@Module({
  controllers: [SavedJobsController],
})
export class SavedJobsModule {}
