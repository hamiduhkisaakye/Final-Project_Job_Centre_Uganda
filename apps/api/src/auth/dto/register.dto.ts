import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  fullName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  // Only JOB_SEEKER or COMPANY may self-register; ADMIN accounts are
  // created by an existing admin (see users.controller admin routes).
  @IsEnum(UserRole)
  role: 'JOB_SEEKER' | 'COMPANY';

  // Required when role === COMPANY
  @IsOptional()
  @IsString()
  companyName?: string;
}
