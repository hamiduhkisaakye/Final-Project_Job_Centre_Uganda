import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
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
  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @IsOptional()
  @IsString()
  attachmentType?: string;

  @IsOptional()
  @IsString()
  attachmentName?: string;
}

class ReportDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatController {
  constructor(
    private chat: ChatService,
    private gateway: ChatGateway,
  ) {}

  @Get('me/conversations')
  @Roles('JOB_SEEKER', 'COMPANY')
  list(@CurrentUser() user: JwtUser) {
    return this.chat.myConversations(user);
  }

  @Post('me/conversations')
  @Roles('JOB_SEEKER', 'COMPANY')
  start(@CurrentUser() user: JwtUser, @Body() dto: StartConversationDto) {
    return this.chat.startConversation(user, dto);
  }

  @Get('conversations/:id/messages')
  @Roles('JOB_SEEKER', 'COMPANY')
  async messages(@CurrentUser() user: JwtUser, @Param('id') id: string, @Query('cursor') cursor?: string) {
    await this.chat.assertParticipant(id, user);
    return this.chat.messages(id, cursor);
  }

  @Post('conversations/:id/messages')
  @Roles('JOB_SEEKER', 'COMPANY')
  async send(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: SendMessageDto) {
    await this.chat.assertParticipant(id, user);
    const attachment = dto.attachmentUrl
      ? { url: dto.attachmentUrl, type: dto.attachmentType || 'file', name: dto.attachmentName || 'Attachment' }
      : undefined;
    const message = await this.chat.send(id, user.sub, dto.body || '', false, attachment);
    this.gateway.broadcastMessage(id, message);
    return message;
  }

  @Post('conversations/:id/star')
  @Roles('JOB_SEEKER', 'COMPANY')
  star(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.chat.toggleStar(id, user);
  }

  @Post('conversations/:id/block')
  @Roles('JOB_SEEKER', 'COMPANY')
  block(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: ReportDto) {
    return this.chat.blockAndReport(id, user, dto.reason);
  }

  @Post('conversations/:id/unblock')
  @Roles('JOB_SEEKER', 'COMPANY')
  unblock(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.chat.unblock(id, user);
  }

  @Get('admin/reports')
  @Roles('ADMIN')
  listReports(@Query('status') status?: 'OPEN' | 'RESOLVED') {
    return this.chat.listReports(status);
  }

  @Patch('admin/reports/:id/resolve')
  @Roles('ADMIN')
  resolveReport(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.chat.resolveReport(id, user.sub);
  }
}
