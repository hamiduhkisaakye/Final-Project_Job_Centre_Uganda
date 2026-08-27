import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

class SetUserStatusDto {
  @IsIn(['PENDING', 'ACTIVE', 'SUSPENDED', 'DELETED'])
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DELETED';
}

class SetCompanyStatusDto {
  @IsIn(['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED'])
  status: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('users')
  list(@Query('role') role?: 'ADMIN' | 'COMPANY' | 'JOB_SEEKER') {
    return this.users.list(role);
  }

  @Patch('users/:id')
  setStatus(@Param('id') id: string, @Body() dto: SetUserStatusDto) {
    return this.users.setStatus(id, dto.status);
  }

  @Get('companies')
  listCompanies(@Query('status') status?: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED') {
    return this.users.listCompanies(status);
  }

  @Patch('companies/:id')
  setCompanyStatus(@Param('id') id: string, @Body() dto: SetCompanyStatusDto) {
    return this.users.setCompanyVerification(id, dto.status);
  }

  @Post('embeddings/backfill')
  backfillEmbeddings() {
    return this.users.backfillEmbeddings();
  }
}
