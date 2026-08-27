import { Module } from '@nestjs/common';
import { InterviewsService } from './interviews.service';
import { InterviewsController } from './interviews.controller';
import { CompaniesModule } from '../companies/companies.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [CompaniesModule, ChatModule],
  providers: [InterviewsService],
  controllers: [InterviewsController],
})
export class InterviewsModule {}
