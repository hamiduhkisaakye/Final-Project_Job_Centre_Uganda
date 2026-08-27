import { Module } from '@nestjs/common';
import { CvParserService } from './cv-parser.service';
import { CvPdfService } from './cv-pdf.service';
import { CvController } from './cv.controller';

@Module({
  providers: [CvParserService, CvPdfService],
  controllers: [CvController],
})
export class CvModule {}
