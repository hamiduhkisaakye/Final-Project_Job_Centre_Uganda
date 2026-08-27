import { Controller, Get, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private analytics: AnalyticsService) {}

  @Get('company/analytics')
  @Roles('COMPANY')
  company(@CurrentUser() user: JwtUser) {
    return this.analytics.forCompany(user.sub);
  }

  @Get('admin/analytics')
  @Roles('ADMIN')
  admin() {
    return this.analytics.forAdmin();
  }
}
