import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { CompaniesModule } from '../companies/companies.module';

@Module({
  imports: [CompaniesModule],
  controllers: [UploadsController],
})
export class UploadsModule {}
