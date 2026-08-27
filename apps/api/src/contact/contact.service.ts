import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';

@Injectable()
export class ContactService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateContactMessageDto) {
    return this.prisma.contactMessage.create({ data: dto });
  }

  listAll() {
    return this.prisma.contactMessage.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async markRead(id: string) {
    const message = await this.prisma.contactMessage.findUnique({ where: { id } });
    if (!message) throw new NotFoundException('Message not found');
    return this.prisma.contactMessage.update({ where: { id }, data: { readAt: message.readAt ?? new Date() } });
  }
}
