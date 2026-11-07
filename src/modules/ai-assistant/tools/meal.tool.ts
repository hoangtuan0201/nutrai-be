import { Injectable } from '@nestjs/common';
import { MealSource, MealType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { getVietnamDayRange, getVietnamTodayString } from '../../../common/utils/date.util';

@Injectable()
export class MealTool {
  constructor(private readonly prisma: PrismaService) {}

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
          },
          required: ['mealType', 'name', 'calories'],
        },
      },
    ];
  }

  /**
   * Quick-log a meal or snack on behalf of the user directly from AI chat
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

    const created = await this.prisma.meal.create({
      data: {
        userId,
        mealType,
        name: foodName,
        totalCalories: calories,
        totalProtein: protein,
        totalCarbs: carbs,
        totalFat: fat,
        source: MealSource.AI_TEXT,
        loggedDate,
        loggedAt: new Date(),
        items: {
          create: [
            {
              foodName,
              portionDescription: 'Logged via NutraAI Assistant',
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
    };
  }
}

