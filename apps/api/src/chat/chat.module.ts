import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ChatController } from './chat.controller';
import { CompaniesModule } from '../companies/companies.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [CompaniesModule, NotificationsModule, JwtModule.register({})],
  providers: [ChatService, ChatGateway],
  controllers: [ChatController],
  // Exported so InterviewsService can auto-post a chat message when an
  // interview is scheduled (see interviews.service.ts).
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
