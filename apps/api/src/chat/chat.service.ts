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
        job: { select: { id: true, title: true, slug: true } },
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
        job: { select: { id: true, title: true, slug: true } },
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
      // Collapsed to the viewer's own perspective — a seeker never sees
      // starredByCompany, and vice versa.
      starred: user.role === 'JOB_SEEKER' ? c.starredBySeeker : c.starredByCompany,
      blocked: c.blockedBySeeker || c.blockedByCompany,
    }));
  }

  async toggleStar(conversationId: string, user: JwtUser) {
    const conversation = await this.assertParticipant(conversationId, user);
    const field = user.role === 'JOB_SEEKER' ? 'starredBySeeker' : 'starredByCompany';
    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { [field]: !conversation[field] },
    });
    return { starred: user.role === 'JOB_SEEKER' ? updated.starredBySeeker : updated.starredByCompany };
  }

  // Combined per the product decision — reporting a conversation always
  // blocks it too, since continuing to receive messages from someone
  // you've just reported isn't a real option. Blocking alone (no report)
  // isn't exposed in the UI, but unblock() below still allows undoing a
  // mistaken block.
  async blockAndReport(conversationId: string, user: JwtUser, reason: string) {
    await this.assertParticipant(conversationId, user);
    const field = user.role === 'JOB_SEEKER' ? 'blockedBySeeker' : 'blockedByCompany';
    await this.prisma.$transaction([
      this.prisma.conversation.update({ where: { id: conversationId }, data: { [field]: true } }),
      this.prisma.conversationReport.create({ data: { conversationId, reporterId: user.sub, reason } }),
    ]);
    return { success: true };
  }

  async unblock(conversationId: string, user: JwtUser) {
    await this.assertParticipant(conversationId, user);
    const field = user.role === 'JOB_SEEKER' ? 'blockedBySeeker' : 'blockedByCompany';
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { [field]: false } });
    return { success: true };
  }

  // Admin "Reports" inbox — same shape/spirit as the job moderation queue.
  async listReports(status?: 'OPEN' | 'RESOLVED') {
    return this.prisma.conversationReport.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        conversation: {
          include: {
            company: { select: { name: true, slug: true } },
            seeker: { select: { email: true, seekerProfile: { select: { fullName: true } } } },
            job: { select: { title: true } },
          },
        },
        reporter: { select: { email: true, role: true } },
      },
    });
  }

  async resolveReport(id: string, adminId: string) {
    return this.prisma.conversationReport.update({
      where: { id },
      data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedById: adminId },
    });
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

  async send(
    conversationId: string,
    senderId: string,
    body: string,
    isSystem = false,
    attachment?: { url: string; type: string; name: string },
  ) {
    const trimmed = body.trim();
    if (!trimmed && !attachment) throw new BadRequestException('Message body cannot be empty');

    if (!isSystem) {
      const existing = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
      if (existing?.blockedBySeeker || existing?.blockedByCompany) {
        throw new ForbiddenException('This conversation has been blocked');
      }
    }

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId,
          senderId,
          body: trimmed,
          isSystem,
          attachmentUrl: attachment?.url,
          attachmentType: attachment?.type,
          attachmentName: attachment?.name,
        },
      }),
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

  // Returns how many rows actually flipped to read, so the caller (the
  // gateway) only broadcasts a read-receipt event when something changed.
  async markRead(conversationId: string, userId: string): Promise<number> {
    const result = await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    });
    return result.count;
  }
}
