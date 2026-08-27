import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BlogCategory } from '@prisma/client';

export class CreateBlogPostDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  excerpt?: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @IsOptional()
  @IsEnum(BlogCategory)
  category?: BlogCategory;
}
