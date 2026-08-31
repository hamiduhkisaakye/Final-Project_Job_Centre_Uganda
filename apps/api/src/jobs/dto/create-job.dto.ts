import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { EmploymentType } from '@prisma/client';

export class ScreeningQuestionDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  text: string;

  @IsIn(['YES_NO', 'SHORT_TEXT'])
  type: 'YES_NO' | 'SHORT_TEXT';

  @IsOptional()
  @IsBoolean()
  knockout?: boolean;

  @IsOptional()
  @IsIn(['YES', 'NO'])
  requiredAnswer?: 'YES' | 'NO';
}

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

  // Optional application deadline — shown on the job detail page as
  // "Closes in N days" when set. Applications aren't actually blocked past
  // this date; it's informational only (matches how moderation/status
  // already governs whether a job accepts applications).
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  requireVideoResume?: boolean;

  // Capped at 3 — enforced here for a quick 400 on an oversized payload,
  // and again in jobs.service.ts#assertScreeningQuestions for the
  // knockout/requiredAnswer shape checks the class-validator decorators
  // above can't express (requiredAnswer only makes sense for YES_NO).
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => ScreeningQuestionDto)
  screeningQuestions?: ScreeningQuestionDto[];
}
