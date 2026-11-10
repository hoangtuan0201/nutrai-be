import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiAssistantController } from './ai-assistant.controller';
import { AiAssistantService } from './ai-assistant.service';
import { AiAssistantRepository } from './ai-assistant.repository';
import { ContextService } from './services/context.service';
import { PromptService } from './services/prompt.service';
import { LlmService } from './services/llm.service';
import { NutritionTool } from './tools/nutrition.tool';
import { MealTool } from './tools/meal.tool';
import { ProgressTool } from './tools/progress.tool';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ProgressModule } from '../progress/progress.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule, ProgressModule, AiModule],
  controllers: [AiAssistantController],
  providers: [
    AiAssistantService,
    AiAssistantRepository,
    ContextService,
    PromptService,
    LlmService,
    NutritionTool,
    MealTool,
    ProgressTool,
  ],
  exports: [AiAssistantService],
})
export class AiAssistantModule {}

