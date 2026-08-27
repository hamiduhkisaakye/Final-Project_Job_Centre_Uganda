import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { JwtUser } from '../auth/decorators/current-user.decorator';

function room(conversationId: string) {
  return `conversation:${conversationId}`;
}

// Real-time layer over ChatService — REST (chat.controller.ts) covers
// history/listing/starting threads; this gateway covers push delivery once
// a thread is open. Auth happens once at handshake (a short-lived access
// token in `socket.handshake.auth.token`, the same one used for REST calls)
// rather than per-event, since Socket.IO connections are already
// session-scoped.
@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: process.env.WEB_ORIGIN || 'http://localhost:3000', credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private chat: ChatService,
    private jwt: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) throw new Error('No token provided');
      const payload = await this.jwt.verifyAsync<JwtUser>(token, {
        secret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me',
      });
      client.data.user = payload;
    } catch {
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('conversation:join')
  async join(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
    const user: JwtUser = client.data.user;
    if (!user) return;
    try {
      await this.chat.assertParticipant(data.conversationId, user);
      client.join(room(data.conversationId));
      await this.chat.markRead(data.conversationId, user.sub);
    } catch {
      client.emit('error', { message: 'Cannot join that conversation' });
    }
  }

  @SubscribeMessage('conversation:leave')
  leave(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
    client.leave(room(data.conversationId));
  }

  @SubscribeMessage('message:send')
  async sendMessage(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string; body: string }) {
    const user: JwtUser = client.data.user;
    if (!user) return;
    try {
      await this.chat.assertParticipant(data.conversationId, user);
      const message = await this.chat.send(data.conversationId, user.sub, data.body);
      this.server.to(room(data.conversationId)).emit('message:new', { conversationId: data.conversationId, message });
    } catch (err) {
      client.emit('error', { message: err instanceof Error ? err.message : 'Could not send message' });
    }
  }

  // Called by ChatController after a REST-based send (e.g. a client that
  // isn't connected over the socket right now) so socket-connected
  // participants still see it arrive live.
  broadcastMessage(conversationId: string, message: unknown) {
    this.server.to(room(conversationId)).emit('message:new', { conversationId, message });
  }
}
