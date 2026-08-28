import { IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;

  @IsString()
  icon: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
