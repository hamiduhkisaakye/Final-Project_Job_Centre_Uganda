import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [JwtModule.register({})],
  providers: [NotificationsService, NotificationsGateway],
  controllers: [NotificationsController],
  // Exported so ChatModule, ApplicationsModule, and ModerationModule can
  // each trigger notifications without depending on each other.
  exports: [NotificationsService],
})
export class NotificationsModule {}
