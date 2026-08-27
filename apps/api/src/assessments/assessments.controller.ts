import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { AssessmentsService } from './assessments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

// Question shape is validated in depth by AssessmentsService#validateQuestions
// (text + options + correctIndex per question) — matches the existing
// convention of lightweight DTO-level checks plus service-level business
// validation used by CreateJobDto for responsibilities/requirements/skills.
class CreateAssessmentDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  questions: { question: string; options: string[]; correctIndex: number }[];

  @IsOptional()
  @IsInt()
  @Min(1)
  passScore?: number;
}

class UpdateAssessmentDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  questions?: { question: string; options: string[]; correctIndex: number }[];

  @IsOptional()
  @IsInt()
  @Min(1)
  passScore?: number;
}

class SubmitAttemptDto {
  @IsArray()
  answers: number[];
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssessmentsController {
  constructor(private assessments: AssessmentsService) {}

  @Get('company/assessments')
  @Roles('COMPANY')
  list(@CurrentUser() user: JwtUser) {
    return this.assessments.listForCompany(user.sub);
  }

  @Post('company/assessments')
  @Roles('COMPANY')
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateAssessmentDto) {
    return this.assessments.create(user.sub, dto);
  }

  @Patch('company/assessments/:id')
  @Roles('COMPANY')
  update(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateAssessmentDto) {
    return this.assessments.update(user.sub, id, dto);
  }

  @Get('assessments/:id')
  @Roles('JOB_SEEKER')
  getOne(@Param('id') id: string) {
    return this.assessments.forSeeker(id);
  }

  @Post('assessments/:id/attempts')
  @Roles('JOB_SEEKER')
  attempt(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: SubmitAttemptDto) {
    return this.assessments.submitAttempt(user.sub, id, dto.answers);
  }

  @Get('me/assessment-attempts')
  @Roles('JOB_SEEKER')
  myAttempts(@CurrentUser() user: JwtUser) {
    return this.assessments.myAttempts(user.sub);
  }
}
