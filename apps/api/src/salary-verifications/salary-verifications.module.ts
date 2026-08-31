import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CompaniesModule } from '../companies/companies.module';
import { SalaryVerificationsService } from './salary-verifications.service';
import { SalaryVerificationsController } from './salary-verifications.controller';

@Module({
  imports: [PrismaModule, CompaniesModule],
  providers: [SalaryVerificationsService],
  controllers: [SalaryVerificationsController],
})
export class SalaryVerificationsModule {}
