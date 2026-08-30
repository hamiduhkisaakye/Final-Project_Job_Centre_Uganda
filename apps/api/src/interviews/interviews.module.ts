import { Module } from '@nestjs/common';
import { InterviewsService } from './interviews.service';
import { InterviewAiService } from './interview-ai.service';
import { InterviewsController } from './interviews.controller';
import { CompaniesModule } from '../companies/companies.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [CompaniesModule, ChatModule],
  providers: [InterviewsService, InterviewAiService],
  controllers: [InterviewsController],
})
export class InterviewsModule {}
