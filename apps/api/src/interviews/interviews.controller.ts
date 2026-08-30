import { Body, Controller, Get, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ArrayNotEmpty, IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { InterviewMode, InterviewStatus } from '@prisma/client';
import { InterviewsService } from './interviews.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

class ProposeInterviewDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsDateString({}, { each: true })
  slots: string[];

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

class ConfirmSlotDto {
  @IsString()
  slotId: string;
}

class RescheduleRequestDto {
  @IsOptional()
  @IsString()
  note?: string;
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
  propose(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: ProposeInterviewDto) {
    return this.interviews.propose(user, id, dto);
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

  @Post('interviews/:id/confirm')
  @Roles('JOB_SEEKER')
  confirm(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: ConfirmSlotDto) {
    return this.interviews.confirmSlot(user, id, dto.slotId);
  }

  @Post('interviews/:id/request-reschedule')
  @Roles('JOB_SEEKER')
  requestReschedule(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: RescheduleRequestDto) {
    return this.interviews.requestReschedule(user, id, dto.note);
  }

  @Get('interviews/:id/prep-questions')
  @Roles('JOB_SEEKER')
  prepQuestions(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.interviews.prepQuestions(user, id);
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
