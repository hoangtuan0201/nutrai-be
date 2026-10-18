import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScanFoodDto } from './dto/scan-food.dto';
import { FoodScanResponse, DetectedFoodScanItem } from './interfaces/food-scan-result.interface';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly apiKey: string;
  // Models evaluated: gemini-flash-lite-latest (fastest & lowest cost) with automatic fallback to gemini-3.5-flash-lite
  private readonly primaryModel = 'gemini-flash-lite-latest';
  private readonly fallbackModel = 'gemini-3.5-flash-lite';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GEMINI_API_SCANFOOD') || '';
    if (!this.apiKey) {
      this.logger.warn('⚠️ GEMINI_API_SCANFOOD is not set in environment variables.');
    }
  }

  /**
   * Visual food recognition using Gemini Multimodal Vision API
   */
  async scanFood(dto: ScanFoodDto): Promise<FoodScanResponse> {
    if (!this.apiKey) {
      throw new InternalServerErrorException('Gemini AI API key is not configured on the server.');
    }

    let base64Data = dto.imageBase64.trim();
    let detectedMime = dto.mimeType || 'image/jpeg';

    // Strip data URL scheme if present (e.g., data:image/jpeg;base64,...)
    const matches = base64Data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (matches) {
      detectedMime = matches[1];
      base64Data = matches[2];
    }

    if (!base64Data) {
      throw new BadRequestException('Image data cannot be empty.');
    }

    const userHintClause = dto.foodHint?.trim()
      ? `User provided context/description: "${dto.foodHint.trim()}". Prioritize this description to identify ingredients, cuts of meat, toppings, cooking style, and broth accurately.`
      : 'No specific hint provided. Identify visible food items based solely on image.';

    const promptText = `
You are an expert clinical dietitian and food vision AI.
Analyze the image of the meal and identify every visible food item.
${userHintClause}

Return ONLY valid JSON matching this schema:
{
  "mealName": "Descriptive English name of meal (e.g. Vietnamese Beef Pho Tai Nam)",
  "estimatedTotalCalories": number (total kcal),
  "confidence": number (between 0.0 and 1.0),
  "advice": "1 short sentence practical nutrition tip",
  "items": [
    {
      "name": "Food item name in English (e.g. Rice Noodles, Beef Flank, Beef Broth, Bean Sprouts)",
      "caloriesPer100g": number (typical calories per 100 grams),
      "estimatedGrams": number (visual estimation of weight in grams, e.g. 150),
      "calories": number (calculated as round(caloriesPer100g * estimatedGrams / 100)),
      "protein": number (grams of protein for this portion),
      "carbs": number (grams of carbohydrates for this portion),
      "fat": number (grams of fat for this portion)
    }
  ]
}

If no food is visible in the image, return:
{
  "mealName": "Unknown Meal",
  "estimatedTotalCalories": 0,
  "confidence": 0,
  "advice": "No food detected. Please re-take the photo clearly.",
  "items": []
}
`;

    const requestPayload = {
      contents: [
        {
          parts: [
            { text: promptText },
            {
              inlineData: {
                mimeType: detectedMime,
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    };

    let rawJsonText = '';

    try {
      rawJsonText = await this.callGeminiWithFallback(this.primaryModel, this.fallbackModel, requestPayload);
    } catch (err: any) {
      this.logger.error(`Gemini API call failed: ${err.message}`, err.stack);
      throw new InternalServerErrorException(
        `Failed to analyze food image with AI: ${err.message || 'Gemini service unavailable'}`,
      );
    }

    try {
      const parsed = JSON.parse(rawJsonText);
      const items: DetectedFoodScanItem[] = Array.isArray(parsed.items)
        ? parsed.items.map((it: any) => {
            const grams = Number(it.estimatedGrams) || 100;
            const cPer100 = Number(it.caloriesPer100g) || 100;
            const computedCalories = Math.round(Number(it.calories) || (cPer100 * grams) / 100);
            return {
              name: String(it.name || 'Food item').trim(),
              caloriesPer100g: Math.round(cPer100),
              estimatedGrams: Math.round(grams),
              calories: computedCalories,
              protein: Math.round((Number(it.protein) || 0) * 10) / 10,
              carbs: Math.round((Number(it.carbs) || 0) * 10) / 10,
              fat: Math.round((Number(it.fat) || 0) * 10) / 10,
            };
          })
        : [];

      const totalCalories =
        items.length > 0
          ? items.reduce((sum, it) => sum + it.calories, 0)
          : Number(parsed.estimatedTotalCalories) || 0;

      const totalProtein =
        Math.round(items.reduce((sum, it) => sum + it.protein, 0) * 10) / 10;
      const totalCarbs =
        Math.round(items.reduce((sum, it) => sum + it.carbs, 0) * 10) / 10;
      const totalFat =
        Math.round(items.reduce((sum, it) => sum + it.fat, 0) * 10) / 10;

      return {
        mealName: parsed.mealName || (items.length > 0 ? items.map((i) => i.name).slice(0, 2).join(' with ') : 'Logged Meal'),
        mealType: dto.mealType || 'LUNCH',
        estimatedTotalCalories: totalCalories,
        totalProtein,
        totalCarbs,
        totalFat,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.85,
        advice: parsed.advice || 'Balanced portion size is key to consistent nutritional progress.',
        items,
      };
    } catch (parseErr: any) {
      this.logger.error(`Failed to parse Gemini response: ${rawJsonText}`, parseErr.stack);
      throw new InternalServerErrorException('AI returned an unexpected response format. Please try again.');
    }
  }

  private async callGeminiWithFallback(
    primary: string,
    fallback: string,
    payload: any,
  ): Promise<string> {
    try {
      return await this.executeGeminiRequest(primary, payload);
    } catch (primaryErr: any) {
      this.logger.warn(`Primary model ${primary} failed (${primaryErr.message}). Attempting fallback ${fallback}...`);
      return await this.executeGeminiRequest(fallback, payload);
    }
  }

  private async executeGeminiRequest(modelName: string, payload: any): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      throw new Error(data.error?.message || `HTTP ${res.status}: ${res.statusText}`);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Gemini API returned an empty candidate text.');
    }

    return text;
  }
}
