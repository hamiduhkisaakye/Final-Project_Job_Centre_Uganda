import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { IsOptional, IsString } from 'class-validator';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

class StartConversationDto {
  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  seekerId?: string;

  // Required — every thread is scoped to one job posting (see
  // chat.service.ts#startConversation).
  @IsString()
  jobId: string;
}

class SendMessageDto {
  @IsString()
  body: string;
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('JOB_SEEKER', 'COMPANY')
export class ChatController {
  constructor(
    private chat: ChatService,
    private gateway: ChatGateway,
  ) {}

  @Get('me/conversations')
  list(@CurrentUser() user: JwtUser) {
    return this.chat.myConversations(user);
  }

  @Post('me/conversations')
  start(@CurrentUser() user: JwtUser, @Body() dto: StartConversationDto) {
    return this.chat.startConversation(user, dto);
  }

  @Get('conversations/:id/messages')
  async messages(@CurrentUser() user: JwtUser, @Param('id') id: string, @Query('cursor') cursor?: string) {
    await this.chat.assertParticipant(id, user);
    return this.chat.messages(id, cursor);
  }

  @Post('conversations/:id/messages')
  async send(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: SendMessageDto) {
    await this.chat.assertParticipant(id, user);
    const message = await this.chat.send(id, user.sub, dto.body);
    this.gateway.broadcastMessage(id, message);
    return message;
  }
}
