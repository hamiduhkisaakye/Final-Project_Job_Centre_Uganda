import { Module } from '@nestjs/common';
import { BlogService } from './blog.service';
import { BlogAiService } from './blog-ai.service';
import { BlogController } from './blog.controller';

@Module({
  providers: [BlogService, BlogAiService],
  controllers: [BlogController],
})
export class BlogModule {}
