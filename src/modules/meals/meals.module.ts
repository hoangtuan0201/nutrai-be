import { Module } from '@nestjs/common';
import { MealsController } from './meals.controller';
import { MealsService } from './meals.service';
import { MealsRepository } from './meals.repository';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [MealsController],
  providers: [MealsService, MealsRepository],
  exports: [MealsService, MealsRepository],
})
export class MealsModule {}
