import { io, Socket } from 'socket.io-client';
import { API_ORIGIN } from './api';

// One socket per browser tab, created lazily on first use and re-created
// whenever the access token changes (e.g. after a silent refresh) since the
// token is only checked once at handshake — see chat.gateway.ts.
let socket: Socket | null = null;
let socketToken: string | null = null;

export function getChatSocket(token: string): Socket {
  if (socket && socketToken === token) return socket;
  if (socket) socket.disconnect();
  socketToken = token;
  socket = io(`${API_ORIGIN}/chat`, {
    auth: { token },
    transports: ['websocket'],
  });
  return socket;
}

export function closeChatSocket() {
  socket?.disconnect();
  socket = null;
  socketToken = null;
}

let notificationsSocket: Socket | null = null;
let notificationsSocketToken: string | null = null;

export function getNotificationsSocket(token: string): Socket {
  if (notificationsSocket && notificationsSocketToken === token) return notificationsSocket;
  if (notificationsSocket) notificationsSocket.disconnect();
  notificationsSocketToken = token;
  notificationsSocket = io(`${API_ORIGIN}/notifications`, {
    auth: { token },
    transports: ['websocket'],
  });
  return notificationsSocket;
}

export function closeNotificationsSocket() {
  notificationsSocket?.disconnect();
  notificationsSocket = null;
  notificationsSocketToken = null;
}
