import { IsOptional, IsString } from 'class-validator';

export class EnhanceBlogPostDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  excerpt?: string;

  @IsString()
  content: string;
}
