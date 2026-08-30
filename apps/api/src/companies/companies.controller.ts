import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

class ReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

class RespondDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  response: string;
}

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

  @Get(':id/follow')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('JOB_SEEKER')
  async followStatus(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return { following: await this.companies.isFollowing(id, user.sub) };
  }

  @Post(':id/follow')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('JOB_SEEKER')
  follow(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.companies.follow(id, user.sub);
  }

  @Delete(':id/follow')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('JOB_SEEKER')
  unfollow(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.companies.unfollow(id, user.sub);
  }

  @Get(':id/reviews')
  listReviews(@Param('id') id: string) {
    return this.companies.listReviews(id);
  }

  @Get(':id/reviews/mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('JOB_SEEKER')
  myReview(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.companies.myReview(id, user.sub);
  }

  @Post(':id/reviews')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('JOB_SEEKER')
  upsertReview(@Param('id') id: string, @Body() dto: ReviewDto, @CurrentUser() user: JwtUser) {
    return this.companies.upsertReview(id, user.sub, dto);
  }

  @Delete(':id/reviews')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('JOB_SEEKER')
  deleteReview(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.companies.deleteReview(id, user.sub);
  }

  @Post(':id/reviews/:reviewId/response')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('COMPANY')
  respondToReview(
    @Param('id') id: string,
    @Param('reviewId') reviewId: string,
    @Body() dto: RespondDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.companies.respondToReview(id, reviewId, user.sub, dto.response);
  }
}
