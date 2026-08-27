import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtUser } from '../auth/decorators/current-user.decorator';

// Push layer for NotificationsService — a small standalone gateway rather
// than piggybacking on ChatGateway, to avoid a module cycle (ChatService
// itself needs to trigger a "new message" notification, so ChatModule
// depends on NotificationsModule; if the push mechanism lived in
// ChatGateway, NotificationsModule would need to depend back on ChatModule
// for it). Every socket here belongs to exactly one user, so it auto-joins
// a per-user room on connect instead of exposing join/leave events like
// /chat does for per-conversation rooms.
@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: process.env.WEB_ORIGIN || 'http://localhost:3000', credentials: true },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(private jwt: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) throw new Error('No token provided');
      const payload = await this.jwt.verifyAsync<JwtUser>(token, {
        secret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me',
      });
      client.data.user = payload;
      client.join(`user:${payload.sub}`);
    } catch {
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect(true);
    }
  }

  handleDisconnect() {}

  push(userId: string, notification: unknown) {
    this.server.to(`user:${userId}`).emit('notification:new', notification);
  }
}
