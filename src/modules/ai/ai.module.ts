import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiQuotaService } from './ai-quota.service';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../database/prisma/prisma.module';

@Module({
  imports: [ConfigModule, AuthModule, PrismaModule],
  controllers: [AiController],
  providers: [AiService, AiQuotaService],
  exports: [AiService, AiQuotaService],
})
export class AiModule {}
