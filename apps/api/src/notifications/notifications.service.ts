import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private gateway: NotificationsGateway,
  ) {}

  // Core primitive every trigger calls into. Persists then pushes live —
  // callers wrap this in try/catch (mirroring interviews.service.ts's
  // best-effort chat post) so a notification failure never blocks the
  // primary action (sending a message, moving a stage, etc.).
  async create(userId: string, type: NotificationType, title: string, body: string, link?: string) {
    const notification = await this.prisma.notification.create({
      data: { userId, type, title, body, link },
    });
    this.gateway.push(userId, notification);
    return notification;
  }

  // A company can have several member users (OWNER/RECRUITER/VIEWER) — a
  // company-facing event should reach all of them, not just whoever
  // happens to be `myCompany(userId)` for the acting request.
  async notifyCompany(companyId: string, type: NotificationType, title: string, body: string, link?: string) {
    const members = await this.prisma.companyMember.findMany({
      where: { companyId },
      select: { userId: true },
    });
    await Promise.all(members.map((m) => this.create(m.userId, type, title, body, link)));
  }

  list(userId: string, take = 30) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
