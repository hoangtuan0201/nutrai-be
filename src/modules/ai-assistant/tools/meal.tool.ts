import { Injectable, Logger } from '@nestjs/common';
import { MealSource, MealType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { CloudinaryService } from '../../../common/cloudinary/cloudinary.service';
import { getVietnamDayRange, getVietnamTodayString } from '../../../common/utils/date.util';

@Injectable()
export class MealTool {
  private readonly logger = new Logger(MealTool.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  getDeclarations() {
    return [
      {
        name: 'quick_log_meal',
        description:
          'Log a meal or snack into the user’s daily nutrition log when the user explicitly asks the assistant to record/add a meal.',
        parameters: {
          type: 'OBJECT',
          properties: {
            mealType: {
              type: 'STRING',
              description: 'One of BREAKFAST, LUNCH, DINNER, or SNACK',
            },
            name: {
              type: 'STRING',
              description: 'Descriptive name of the meal or food item',
            },
            calories: {
              type: 'NUMBER',
              description: 'Estimated or specified calories (kcal)',
            },
            protein: {
              type: 'NUMBER',
              description: 'Estimated protein in grams',
            },
            carbs: {
              type: 'NUMBER',
              description: 'Estimated carbohydrates in grams',
            },
            fat: {
              type: 'NUMBER',
              description: 'Estimated fat in grams',
            },
            imageUrl: {
              type: 'STRING',
              description: 'Optional URL of the food photo if available',
            },
          },
          required: ['mealType', 'name', 'calories'],
        },
      },
    ];
  }

  /**
   * Quick-log a meal or snack on behalf of the user directly from AI chat.
   * If an image is attached to the chat turn or provided in args, it is uploaded to Cloudinary
   * and attached to the Meal record as MealSource.AI_IMAGE (identical to AI Scan Food).
   */
  async quickLogMeal(
    userId: string,
    args: {
      mealType?: string;
      name: string;
      calories: number;
      protein?: number;
      carbs?: number;
      fat?: number;
      date?: string;
      imageUrl?: string | null;
      imageBase64?: string | null;
    },
  ) {
    const validMealTypes: MealType[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];
    const rawType = (args.mealType || 'SNACK').toUpperCase() as MealType;
    const mealType: MealType = validMealTypes.includes(rawType) ? rawType : 'SNACK';

    const { loggedDate, dateString } = getVietnamDayRange(args.date || getVietnamTodayString());
    const calories = Math.max(0, Math.round(Number(args.calories) || 0));
    const protein = Math.max(0, Math.round((Number(args.protein) || 0) * 10) / 10);
    const carbs = Math.max(0, Math.round((Number(args.carbs) || 0) * 10) / 10);
    const fat = Math.max(0, Math.round((Number(args.fat) || 0) * 10) / 10);
    const foodName = (args.name || 'Quick AI Logged Meal').trim();

    // Resolve Cloudinary imageUrl if photo is attached
    let finalImageUrl: string | null = args.imageUrl || null;
    if (!finalImageUrl && args.imageBase64) {
      try {
        finalImageUrl = await this.cloudinaryService.uploadImage(
          args.imageBase64,
          'nutraai/meals',
        );
        this.logger.log(`Uploaded food image from AI Assistant to Cloudinary: ${finalImageUrl}`);
      } catch (err: any) {
        this.logger.warn(`Failed to upload AI Assistant image to Cloudinary: ${err.message}`);
      }
    }

    const hasImage = Boolean(finalImageUrl);
    const source: MealSource = hasImage ? MealSource.AI_IMAGE : MealSource.AI_TEXT;
    const portionDescription = hasImage
      ? 'Logged from AI photo analysis'
      : 'Logged via NutrAI Assistant';

    const created = await this.prisma.meal.create({
      data: {
        userId,
        mealType,
        name: foodName,
        totalCalories: calories,
        totalProtein: protein,
        totalCarbs: carbs,
        totalFat: fat,
        imageUrl: finalImageUrl || null,
        source,
        loggedDate,
        loggedAt: new Date(),
        items: {
          create: [
            {
              foodName,
              portionDescription,
              quantity: 1,
              unit: 'serving',
              calories,
              protein,
              carbs,
              fat,
              sortOrder: 0,
            },
          ],
        },
      },
    });

    return {
      success: true,
      mealId: created.id,
      date: dateString,
      mealType,
      name: foodName,
      calories,
      protein,
      carbs,
      fat,
      imageUrl: finalImageUrl || null,
      source,
    };
  }
}

