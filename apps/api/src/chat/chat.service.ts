import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompaniesService } from '../companies/companies.service';
import { NotificationsService } from '../notifications/notifications.service';
import { JwtUser } from '../auth/decorators/current-user.decorator';

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private companies: CompaniesService,
    private notifications: NotificationsService,
  ) {}

  // Threads are one-per (company, seeker, job) triple (see @@unique on
  // Conversation) — messaging the same counterpart about a different job
  // opens a separate thread, so a recruiter always has the context of
  // which posting a conversation is about instead of one blended thread
  // covering every job that seeker ever talked to them about. Messaging
  // about the same job twice just reopens that job's existing thread.
  async startConversation(user: JwtUser, dto: { companyId?: string; seekerId?: string; jobId: string }) {
    if (!dto.jobId) throw new BadRequestException('jobId is required');
    let companyId: string;
    let seekerId: string;

    if (user.role === 'JOB_SEEKER') {
      if (!dto.companyId) throw new BadRequestException('companyId is required');
      companyId = dto.companyId;
      seekerId = user.sub;
    } else if (user.role === 'COMPANY') {
      if (!dto.seekerId) throw new BadRequestException('seekerId is required');
      const company = await this.companies.myCompany(user.sub);
      companyId = company.id;
      seekerId = dto.seekerId;
    } else {
      throw new ForbiddenException('Admins do not participate in conversations');
    }

    return this.prisma.conversation.upsert({
      where: { companyId_seekerId_jobId: { companyId, seekerId, jobId: dto.jobId } },
      update: {},
      create: { companyId, seekerId, jobId: dto.jobId },
      include: {
        company: { select: { id: true, name: true, slug: true, logoUrl: true } },
        // Full seekerProfile (not just headline) so the company side of a
        // chat thread can show a "View profile" panel without a second
        // request — see MessagesPanel.tsx.
        seeker: { select: { id: true, email: true, seekerProfile: true } },
        job: { select: { id: true, title: true } },
      },
    });
  }

  async myConversations(user: JwtUser) {
    const where =
      user.role === 'JOB_SEEKER'
        ? { seekerId: user.sub }
        : { companyId: (await this.companies.myCompany(user.sub)).id };

    const conversations = await this.prisma.conversation.findMany({
      where,
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        company: { select: { id: true, name: true, slug: true, logoUrl: true } },
        // Full seekerProfile (not just headline) so the company side of a
        // chat thread can show a "View profile" panel without a second
        // request — see MessagesPanel.tsx.
        seeker: { select: { id: true, email: true, seekerProfile: true } },
        job: { select: { id: true, title: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    const unreadCounts = await this.prisma.message.groupBy({
      by: ['conversationId'],
      where: { conversationId: { in: conversations.map((c) => c.id) }, senderId: { not: user.sub }, readAt: null },
      _count: true,
    });
    const unreadByConversation = new Map(unreadCounts.map((u) => [u.conversationId, u._count]));

    return conversations.map((c) => ({
      ...c,
      lastMessage: c.messages[0] || null,
      messages: undefined,
      unreadCount: unreadByConversation.get(c.id) || 0,
    }));
  }

  async assertParticipant(conversationId: string, user: JwtUser) {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) throw new NotFoundException('Conversation not found');

    if (user.role === 'JOB_SEEKER') {
      if (conversation.seekerId !== user.sub) throw new ForbiddenException('Not part of this conversation');
    } else if (user.role === 'COMPANY') {
      await this.companies.assertMember(conversation.companyId, user.sub);
    } else {
      throw new ForbiddenException('Not part of this conversation');
    }
    return conversation;
  }

  async messages(conversationId: string, cursor?: string, take = 30) {
    const items = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
    });
    return {
      data: items.reverse(),
      nextCursor: items.length === take ? items[0].id : null,
    };
  }

  async send(conversationId: string, senderId: string, body: string, isSystem = false) {
    const trimmed = body.trim();
    if (!trimmed) throw new BadRequestException('Message body cannot be empty');

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({ data: { conversationId, senderId, body: trimmed, isSystem } }),
      this.prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } }),
    ]);

    // Best-effort — a failed notification must never fail message delivery.
    // Skipped for system messages: the caller (e.g. companyMoveStage) already
    // fires its own, more specific notification for that event, so a
    // generic "new message" one here would just be a duplicate.
    try {
      if (isSystem) return message;
      const conversation = await this.prisma.conversation.findUniqueOrThrow({
        where: { id: conversationId },
        include: { job: { select: { title: true } } },
      });
      if (senderId === conversation.seekerId) {
        await this.notifications.notifyCompany(
          conversation.companyId,
          'MESSAGE',
          'New message',
          `New message about ${conversation.job.title}`,
          `/company/messages?c=${conversationId}`,
        );
      } else {
        await this.notifications.create(
          conversation.seekerId,
          'MESSAGE',
          'New message',
          `New message about ${conversation.job.title}`,
          `/dashboard/messages?c=${conversationId}`,
        );
      }
    } catch {
      /* non-critical */
    }

    return message;
  }

  async markRead(conversationId: string, userId: string) {
    await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
