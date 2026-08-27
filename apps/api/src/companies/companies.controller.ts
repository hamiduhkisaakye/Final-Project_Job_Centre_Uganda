import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

@Controller('companies')
export class CompaniesController {
  constructor(private companies: CompaniesService) {}

  @Get()
  list(@Query('q') q?: string) {
    return this.companies.listPublic(q);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('COMPANY')
  me(@CurrentUser() user: JwtUser) {
    return this.companies.myCompany(user.sub);
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.companies.findBySlug(slug);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('COMPANY')
  update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: JwtUser) {
    return this.companies.update(id, user.sub, body);
  }
}
