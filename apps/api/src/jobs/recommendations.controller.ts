import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

@Controller('me')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('JOB_SEEKER')
export class RecommendationsController {
  constructor(private jobs: JobsService) {}

  @Get('recommendations')
  recommendations(@CurrentUser() user: JwtUser, @Query('limit') limit?: string) {
    return this.jobs.recommendationsFor(user.sub, limit ? Number(limit) : undefined);
  }
}
