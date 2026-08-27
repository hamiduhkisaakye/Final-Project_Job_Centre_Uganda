import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ContactService } from './contact.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller()
export class ContactController {
  constructor(private contact: ContactService) {}

  // Public — no guard. Anyone can submit the Contact page form.
  @Post('contact')
  create(@Body() dto: CreateContactMessageDto) {
    return this.contact.create(dto);
  }

  @Get('admin/contact-messages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  listAll() {
    return this.contact.listAll();
  }

  @Patch('admin/contact-messages/:id/read')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  markRead(@Param('id') id: string) {
    return this.contact.markRead(id);
  }
}
