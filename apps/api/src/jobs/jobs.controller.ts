import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JobsService, JobSearchQuery } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

@Controller('jobs')
export class JobsController {
  constructor(private jobs: JobsService) {}

  @Get()
  search(@Query() query: JobSearchQuery) {
    return this.jobs.search(query);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('COMPANY')
  mine(@CurrentUser() user: JwtUser) {
    return this.jobs.myCompanyJobs(user.sub);
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.jobs.findBySlug(slug);
  }

  @Get(':id/match')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('JOB_SEEKER')
  match(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.jobs.matchFor(user.sub, id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('COMPANY')
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateJobDto) {
    return this.jobs.create(user.sub, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('COMPANY')
  update(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateJobDto) {
    return this.jobs.update(user.sub, id, dto);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('COMPANY')
  publish(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.jobs.submitForReview(user.sub, id);
  }

  @Post(':id/pause')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('COMPANY')
  pause(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.jobs.setStatus(user.sub, id, 'PAUSED');
  }

  @Post(':id/resume')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('COMPANY')
  resume(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.jobs.setStatus(user.sub, id, 'PUBLISHED');
  }

  @Post(':id/close')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('COMPANY')
  close(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.jobs.setStatus(user.sub, id, 'CLOSED');
  }
}
