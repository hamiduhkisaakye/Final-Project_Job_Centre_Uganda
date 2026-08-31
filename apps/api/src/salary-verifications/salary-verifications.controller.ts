import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { SalaryVerificationStatus } from '@prisma/client';
import { SalaryVerificationsService } from './salary-verifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

class SubmitVerificationDto {
  @IsString()
  evidenceUrl: string;

  @IsString()
  evidenceName: string;

  @IsOptional()
  @IsString()
  note?: string;
}

class RejectVerificationDto {
  @IsString()
  reason: string;
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalaryVerificationsController {
  constructor(private salaryVerifications: SalaryVerificationsService) {}

  @Post('company/jobs/:jobId/salary-verification')
  @Roles('COMPANY')
  submit(@CurrentUser() user: JwtUser, @Param('jobId') jobId: string, @Body() dto: SubmitVerificationDto) {
    return this.salaryVerifications.submit(user.sub, jobId, dto.evidenceUrl, dto.evidenceName, dto.note);
  }

  @Get('company/jobs/:jobId/salary-verification')
  @Roles('COMPANY')
  forJob(@CurrentUser() user: JwtUser, @Param('jobId') jobId: string) {
    return this.salaryVerifications.forJob(user.sub, jobId);
  }

  @Get('admin/salary-verifications')
  @Roles('ADMIN')
  listPending(@Query('status') status?: SalaryVerificationStatus) {
    return this.salaryVerifications.listPending(status);
  }

  @Post('admin/salary-verifications/:id/approve')
  @Roles('ADMIN')
  approve(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.salaryVerifications.approve(user.sub, id);
  }

  @Post('admin/salary-verifications/:id/reject')
  @Roles('ADMIN')
  reject(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: RejectVerificationDto) {
    return this.salaryVerifications.reject(user.sub, id, dto.reason);
  }
}
