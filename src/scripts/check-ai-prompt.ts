import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ContextService } from '../modules/ai-assistant/services/context.service';
import { PromptService } from '../modules/ai-assistant/services/prompt.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const contextService = app.get(ContextService);
  const promptService = app.get(PromptService);

  const userId = '22222222-2222-2222-2222-222222222222';
  const ctx = await contextService.buildUserNutritionContext(userId);
  console.log('=== CONTEXT ===');
  console.log('profile:', ctx.profile);
  console.log('progress.recentWeights:', ctx.progress.recentWeights);

  const prompt = promptService.buildHybridSystemInstruction(ctx);
  console.log('=== SYSTEM PROMPT ===');
  console.log(prompt);

  await app.close();
}
main();

