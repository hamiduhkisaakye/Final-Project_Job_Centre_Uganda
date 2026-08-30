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

  // Presence is scoped per-conversation ("is the other party looking at
  // THIS thread right now"), not globally per-user — a seeker's "other
  // party" on a thread is a company, which can have several member users,
  // so there's no single userId to track globally for that side. Any
  // company member currently viewing the thread counts as "online" for it.
  private roomViewers = new Map<string, Set<string>>();

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
    const user: JwtUser | undefined = client.data.user;
    if (user) {
      for (const [conversationId, viewers] of this.roomViewers) {
        if (viewers.delete(user.sub)) {
          this.server.to(room(conversationId)).emit('presence:update', { conversationId, userId: user.sub, online: false });
        }
      }
    }
    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('conversation:join')
  async join(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
    const user: JwtUser = client.data.user;
    if (!user) return;
    try {
      await this.chat.assertParticipant(data.conversationId, user);
      client.join(room(data.conversationId));

      const readCount = await this.chat.markRead(data.conversationId, user.sub);
      if (readCount > 0) {
        this.server.to(room(data.conversationId)).emit('message:read', { conversationId: data.conversationId, readerId: user.sub, readAt: new Date() });
      }

      if (!this.roomViewers.has(data.conversationId)) this.roomViewers.set(data.conversationId, new Set());
      const viewers = this.roomViewers.get(data.conversationId)!;
      const others = [...viewers].filter((id) => id !== user.sub);
      viewers.add(user.sub);
      // Tell whoever's already here that this user just joined…
      client.to(room(data.conversationId)).emit('presence:update', { conversationId: data.conversationId, userId: user.sub, online: true });
      // …and tell the joining client about everyone already present.
      for (const otherId of others) {
        client.emit('presence:update', { conversationId: data.conversationId, userId: otherId, online: true });
      }
    } catch {
      client.emit('error', { message: 'Cannot join that conversation' });
    }
  }

  @SubscribeMessage('conversation:leave')
  leave(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
    const user: JwtUser = client.data.user;
    client.leave(room(data.conversationId));
    const viewers = this.roomViewers.get(data.conversationId);
    if (user && viewers?.delete(user.sub)) {
      this.server.to(room(data.conversationId)).emit('presence:update', { conversationId: data.conversationId, userId: user.sub, online: false });
    }
  }

  @SubscribeMessage('message:send')
  async sendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; body: string; attachment?: { url: string; type: string; name: string } },
  ) {
    const user: JwtUser = client.data.user;
    if (!user) return;
    try {
      await this.chat.assertParticipant(data.conversationId, user);
      const message = await this.chat.send(data.conversationId, user.sub, data.body, false, data.attachment);
      this.server.to(room(data.conversationId)).emit('message:new', { conversationId: data.conversationId, message });
    } catch (err) {
      client.emit('error', { message: err instanceof Error ? err.message : 'Could not send message' });
    }
  }

  @SubscribeMessage('typing:start')
  typingStart(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
    const user: JwtUser = client.data.user;
    if (!user) return;
    client.to(room(data.conversationId)).emit('typing:update', { conversationId: data.conversationId, userId: user.sub, isTyping: true });
  }

  @SubscribeMessage('typing:stop')
  typingStop(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
    const user: JwtUser = client.data.user;
    if (!user) return;
    client.to(room(data.conversationId)).emit('typing:update', { conversationId: data.conversationId, userId: user.sub, isTyping: false });
  }

  // Called by ChatController after a REST-based send (e.g. a client that
  // isn't connected over the socket right now) so socket-connected
  // participants still see it arrive live.
  broadcastMessage(conversationId: string, message: unknown) {
    this.server.to(room(conversationId)).emit('message:new', { conversationId, message });
  }
}
