import { Injectable } from '@nestjs/common';
import { FullAiContextSnapshot } from '../interfaces/ai-assistant.interface';

@Injectable()
export class PromptService {
  /**
   * Builds Layer 1 Direct Context Injection System Prompt
   */
  buildHybridSystemInstruction(ctx: FullAiContextSnapshot): string {
    const { todayNutrition: t, profile: p, progress: prog } = ctx;

    const remainingProtein = Math.max(0, Math.round((t.proteinTarget - t.proteinConsumed) * 10) / 10);
    const remainingCarbs = Math.max(0, Math.round((t.carbsTarget - t.carbsConsumed) * 10) / 10);
    const remainingFat = Math.max(0, Math.round((t.fatTarget - t.fatConsumed) * 10) / 10);

    const mealsListText =
      t.meals.length > 0
        ? t.meals
            .map(
              (m) =>
                `  - [${m.mealType}] ${m.name}: ${m.calories} kcal (P: ${m.protein}g, C: ${m.carbs}g, F: ${m.fat}g)${
                  m.items.length ? ` | Items: ${m.items.join(', ')}` : ''
                }`,
            )
            .join('\n')
        : '  - No meals logged yet today.';

    const weightTrendText =
      prog.recentWeights.length > 0
        ? prog.recentWeights.map((w) => `${w.date}: ${w.weightKg}kg`).join(' -> ')
        : 'No weight logs recorded yet.';

    const calorieTrendText =
      prog.recentDailyCalories.length > 0
        ? prog.recentDailyCalories
            .map((d) => `${d.date}: ${d.calories} kcal (P:${d.protein}g)`)
            .join(' | ')
        : 'No recent daily logs.';

    return `You are **NutraAI Coach**, a friendly, evidence-based personal nutrition coach and dietitian built into the NutraAI mobile app.

=== USER PROFILE ===
- Name: ${p.name}
- Gender: ${p.gender || 'Not specified'} | Age: ${p.age ?? 'Not specified'}
- Height: ${p.heightCm ? `${p.heightCm} cm` : 'N/A'} | Current Weight: ${p.currentWeightKg ? `${p.currentWeightKg} kg` : 'N/A'} | Target Weight: ${p.targetWeightKg ? `${p.targetWeightKg} kg` : 'N/A'} | BMI: ${p.bmi ?? 'N/A'}
- Activity Level: ${p.activityLevel || 'MODERATE'} | Primary Fitness Goal: ${p.fitnessGoal || 'MAINTENANCE'}

=== TODAY'S NUTRITION (${t.date}) ===
- Calories: ${t.caloriesConsumed} / ${t.caloriesTarget} kcal (${t.caloriesRemaining} kcal remaining)
- Protein: ${t.proteinConsumed}g / ${t.proteinTarget}g (${remainingProtein}g remaining)
- Carbs: ${t.carbsConsumed}g / ${t.carbsTarget}g (${remainingCarbs}g remaining)
- Fat: ${t.fatConsumed}g / ${t.fatTarget}g (${remainingFat}g remaining)
- Meals Logged Today (${t.mealsLoggedCount}):
${mealsListText}

=== 7-DAY PROGRESS TRENDS ===
- Weight Trend: ${weightTrendText}
- 7-Day Calorie History: ${calorieTrendText}

=== OPERATING GUIDELINES (HYBRID ARCHITECTURE) ===
1. **Language**: Respond in clear, natural **English** by default. Only respond in another language if the user explicitly writes their message in that language.
2. **Personalization**: Always reference the user's exact numbers above (e.g., exact remaining protein/calories, current vs. target weight, meals already eaten today). Never give generic advice when specific context is available.
3. **Formatting**: Keep responses concise (120-220 words), warm, and easy to scan on a mobile screen using bullet points and bold highlights for key macros/calories.
4. **Photo / Image Analysis in Chat**:
   - If the user attaches a photo of food/meal in chat: identify the visible food items, estimate total calories and macros (Protein, Carbs, Fat), and tell the user whether it fits their remaining daily budget (${t.caloriesRemaining} kcal remaining).
   - If the user asks to log/record the photographed meal (e.g., "Log this meal"), call \`quick_log_meal\` with your estimated calories and macros.
5. **When to use Tools vs. Injected Context**:
   - **DO NOT call any tool** if the user asks about today's macros/calories, meal suggestions for today, or their recent 7-day weight/calorie progress — all of that data is ALREADY provided above! Answer immediately.
   - **Call \`get_nutrition_by_date_range\`** ONLY when the user asks about a specific historical date outside the 7-day window above.
   - **Call \`search_food_database\`** ONLY when the user asks to look up nutrition facts of a specific ingredient in the database.
   - **Call \`quick_log_meal\`** ONLY when the user explicitly asks you to log/record/add a food or meal for them.
   - **Call \`log_body_weight\`** ONLY when the user explicitly asks you to log or update their body weight.`;
  }

  /**
   * Formats recent DB messages + new user message (and optional multimodal image) into Gemini contents array
   */
  buildConversationContents(
    previousMessages: Array<{ role: string; content: string }>,
    newUserMessage: string,
    imageAttachment?: { base64?: string; mimeType?: string },
  ): Array<{ role: string; parts: any[] }> {
    const historyContents = (previousMessages || []).slice(-12).map((msg) => ({
      role: msg.role === 'ASSISTANT' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const userParts: any[] = [{ text: newUserMessage }];

    if (imageAttachment?.base64) {
      let cleanBase64 = imageAttachment.base64.trim();
      let detectedMime = imageAttachment.mimeType || 'image/jpeg';

      const matches = cleanBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (matches) {
        detectedMime = matches[1];
        cleanBase64 = matches[2];
      }

      if (cleanBase64) {
        userParts.push({
          inlineData: {
            mimeType: detectedMime,
            data: cleanBase64,
          },
        });
      }
    }

    return [
      ...historyContents,
      {
        role: 'user',
        parts: userParts,
      },
    ];
  }
}
