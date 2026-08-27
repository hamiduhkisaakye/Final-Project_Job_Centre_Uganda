import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { ModerationService } from './moderation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

class DecideDto {
  @IsIn(['APPROVED', 'REJECTED', 'ESCALATED'])
  decision: 'APPROVED' | 'REJECTED' | 'ESCALATED';

  @IsOptional()
  @IsString()
  note?: string;
}

@Controller('admin/moderation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ModerationController {
  constructor(private moderation: ModerationService) {}

  @Get()
  queue(@Query('decision') decision?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ESCALATED') {
    return this.moderation.queue(decision);
  }

  @Patch(':id')
  decide(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: DecideDto) {
    return this.moderation.decide(user.sub, id, dto.decision, dto.note);
  }
}
