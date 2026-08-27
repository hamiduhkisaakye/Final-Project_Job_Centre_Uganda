import { Module } from '@nestjs/common';
import { MatchingService } from './matching.service';
import { EmbeddingsService } from './embeddings.service';

@Module({
  providers: [MatchingService, EmbeddingsService],
  exports: [MatchingService, EmbeddingsService],
})
export class MatchingModule {}
