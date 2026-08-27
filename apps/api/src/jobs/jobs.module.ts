import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { RecommendationsController } from './recommendations.controller';
import { CompaniesModule } from '../companies/companies.module';
import { MatchingModule } from '../matching/matching.module';

@Module({
  imports: [CompaniesModule, MatchingModule],
  providers: [JobsService],
  controllers: [JobsController, RecommendationsController],
  exports: [JobsService],
})
export class JobsModule {}
