import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

@Controller()
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get('me/notifications')
  list(@CurrentUser() user: JwtUser) {
    return this.notifications.list(user.sub);
  }

  @Get('me/notifications/unread-count')
  unreadCount(@CurrentUser() user: JwtUser) {
    return this.notifications.unreadCount(user.sub);
  }

  @Patch('me/notifications/:id/read')
  markRead(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.notifications.markRead(user.sub, id);
  }

  @Patch('me/notifications/read-all')
  markAllRead(@CurrentUser() user: JwtUser) {
    return this.notifications.markAllRead(user.sub);
  }
}
