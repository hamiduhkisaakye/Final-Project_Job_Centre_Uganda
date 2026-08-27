import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { EmploymentType } from '@prisma/client';

export class CreateJobDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsArray()
  responsibilities?: string[];

  @IsOptional()
  @IsArray()
  requirements?: string[];

  @IsEnum(EmploymentType)
  employmentType: EmploymentType;

  @IsOptional()
  @IsString()
  seniority?: string;

  @IsString()
  category: string;

  @IsString()
  location: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMax?: number;

  @IsOptional()
  @IsString()
  salaryCurrency?: string;

  @IsOptional()
  @IsString()
  salaryPeriod?: string;

  @IsOptional()
  @IsBoolean()
  salaryDisclosed?: boolean;

  @IsOptional()
  @IsArray()
  skills?: string[];

  // Optional — must be one of the posting company's own Assessment ids;
  // ownership isn't re-checked at the DTO layer, only in jobs.service.ts.
  @IsOptional()
  @IsString()
  assessmentId?: string;
}
