import { Body, Controller, Get, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { InterviewMode, InterviewStatus } from '@prisma/client';
import { InterviewsService } from './interviews.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

class ScheduleInterviewDto {
  @IsDateString()
  scheduledAt: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  durationMinutes?: number;

  @IsEnum(InterviewMode)
  mode: InterviewMode;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class UpdateInterviewDto {
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  durationMinutes?: number;

  @IsOptional()
  @IsEnum(InterviewMode)
  mode?: InterviewMode;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(InterviewStatus)
  status?: InterviewStatus;
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class InterviewsController {
  constructor(private interviews: InterviewsService) {}

  @Post('applications/:id/interviews')
  @Roles('COMPANY')
  schedule(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: ScheduleInterviewDto) {
    return this.interviews.schedule(user, id, dto);
  }

  @Get('applications/:id/interviews')
  @Roles('JOB_SEEKER', 'COMPANY')
  list(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.interviews.list(user, id);
  }

  @Patch('interviews/:id')
  @Roles('COMPANY')
  update(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateInterviewDto) {
    return this.interviews.update(user, id, dto);
  }

  @Get('me/interviews')
  @Roles('JOB_SEEKER', 'COMPANY')
  mine(@CurrentUser() user: JwtUser) {
    return this.interviews.myInterviews(user);
  }

  @Get('interviews/:id/ics')
  @Roles('JOB_SEEKER', 'COMPANY')
  async ics(@CurrentUser() user: JwtUser, @Param('id') id: string, @Res() res: Response) {
    const content = await this.interviews.getIcs(id, user);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="interview.ics"');
    res.send(content);
  }
}
