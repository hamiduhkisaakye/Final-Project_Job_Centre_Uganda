import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApplicationStage } from '@prisma/client';
import { ApplicationsService } from './applications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

class ApplyDto {
  @IsString()
  jobId: string;

  @IsOptional()
  @IsString()
  coverLetter?: string;
}

class MoveStageDto {
  @IsIn(['APPLIED', 'IN_REVIEW', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'])
  stage: ApplicationStage;

  @IsOptional()
  @IsString()
  reason?: string;
}

@Controller('applications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApplicationsController {
  constructor(private applications: ApplicationsService) {}

  @Post()
  @Roles('JOB_SEEKER')
  apply(@CurrentUser() user: JwtUser, @Body() dto: ApplyDto) {
    return this.applications.apply(user.sub, dto.jobId, dto.coverLetter);
  }

  @Get()
  list(@CurrentUser() user: JwtUser, @Query('jobId') jobId?: string) {
    return user.role === 'COMPANY'
      ? this.applications.forCompany(user.sub, jobId)
      : this.applications.mine(user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.applications.findOne(id);
  }

  @Patch(':id/stage')
  @Roles('COMPANY')
  moveStage(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: MoveStageDto) {
    return this.applications.companyMoveStage(user.sub, id, dto.stage, dto.reason);
  }

  @Patch(':id/withdraw')
  @Roles('JOB_SEEKER')
  withdraw(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.applications.withdraw(user.sub, id);
  }
}
