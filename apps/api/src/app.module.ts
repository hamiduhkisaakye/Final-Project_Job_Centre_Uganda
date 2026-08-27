import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { JobsModule } from './jobs/jobs.module';
import { ApplicationsModule } from './applications/applications.module';
import { SavedJobsModule } from './saved-jobs/saved-jobs.module';
import { ModerationModule } from './moderation/moderation.module';
import { MatchingModule } from './matching/matching.module';
import { UsersModule } from './users/users.module';
import { ChatModule } from './chat/chat.module';
import { NotificationsModule } from './notifications/notifications.module';
import { UploadsModule } from './uploads/uploads.module';
import { AssessmentsModule } from './assessments/assessments.module';
import { InterviewsModule } from './interviews/interviews.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { BlogModule } from './blog/blog.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    CompaniesModule,
    JobsModule,
    ApplicationsModule,
    SavedJobsModule,
    ModerationModule,
    MatchingModule,
    UsersModule,
    ChatModule,
    NotificationsModule,
    UploadsModule,
    AssessmentsModule,
    InterviewsModule,
    AnalyticsModule,
    BlogModule,
  ],
})
export class AppModule {}
