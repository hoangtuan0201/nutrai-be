import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { getVietnamDayRange } from '../../../common/utils/date.util';

@Injectable()
export class NutritionTool {
  constructor(private readonly prisma: PrismaService) {}

  getDeclarations() {
    return [
      {
        name: 'get_nutrition_by_date_range',
        description:
          'Fetch logged meals and total calories/macros for a specific date or date range (YYYY-MM-DD) when the user asks about dates prior to the last 7 days.',
        parameters: {
          type: 'OBJECT',
          properties: {
            startDate: {
              type: 'STRING',
              description: 'Start date in YYYY-MM-DD format',
            },
            endDate: {
              type: 'STRING',
              description: 'Optional end date in YYYY-MM-DD format (defaults to startDate)',
            },
          },
          required: ['startDate'],
        },
      },
      {
        name: 'search_food_database',
        description:
          'Search the verified NutraAI food catalog for nutrition facts per 100g (calories, protein, carbs, fat).',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: {
              type: 'STRING',
              description: 'Food or ingredient name in English (e.g. chicken breast, salmon, oats)',
            },
          },
          required: ['query'],
        },
      },
    ];
  }

  /**
   * Query nutrition & meals for a specific past date or date range (YYYY-MM-DD)
   */
  async getNutritionByDateRange(
    userId: string,
    startDateStr: string,
    endDateStr?: string,
  ) {
    try {
      const startRange = getVietnamDayRange(startDateStr);
      const endRange = getVietnamDayRange(endDateStr || startDateStr);

      const meals = await this.prisma.meal.findMany({
        where: {
          userId,
          loggedDate: {
            gte: startRange.loggedDate,
            lte: endRange.loggedDate,
          },
        },
        include: { items: true },
        orderBy: [{ loggedDate: 'asc' }, { loggedAt: 'asc' }],
      });

      const totalCalories = Math.round(
        meals.reduce((sum, m) => sum + (m.totalCalories || 0), 0),
      );
      const totalProtein =
        Math.round(meals.reduce((sum, m) => sum + (m.totalProtein || 0), 0) * 10) / 10;
      const totalCarbs =
        Math.round(meals.reduce((sum, m) => sum + (m.totalCarbs || 0), 0) * 10) / 10;
      const totalFat =
        Math.round(meals.reduce((sum, m) => sum + (m.totalFat || 0), 0) * 10) / 10;

      return {
        startDate: startRange.dateString,
        endDate: endRange.dateString,
        mealCount: meals.length,
        totalCalories,
        totalProtein,
        totalCarbs,
        totalFat,
        meals: meals.map((m) => ({
          date: m.loggedDate.toISOString().split('T')[0],
          mealType: m.mealType,
          name: m.name || m.mealType,
          calories: Math.round(m.totalCalories || 0),
          protein: Math.round(m.totalProtein || 0),
          carbs: Math.round(m.totalCarbs || 0),
          fat: Math.round(m.totalFat || 0),
        })),
      };
    } catch (err: any) {
      return { error: err.message || 'Invalid date range requested.' };
    }
  }

  /**
   * Search verified foods in the database for nutrition facts per 100g
   */
  async searchFoods(query: string, limit = 6) {
    const cleanQuery = (query || '').trim();
    if (!cleanQuery) return { foods: [] };

    const foods = await this.prisma.food.findMany({
      where: {
        isActive: true,
        name: {
          contains: cleanQuery,
          mode: 'insensitive',
        },
      },
      take: limit,
      orderBy: { isVerified: 'desc' },
    });

    return {
      query: cleanQuery,
      count: foods.length,
      foods: foods.map((f) => ({
        name: f.name,
        servingSize: `${f.defaultServingSize}${f.servingUnit}`,
        caloriesPer100g: Math.round(f.caloriesPer100g),
        proteinPer100g: Math.round(f.proteinPer100g * 10) / 10,
        carbsPer100g: Math.round(f.carbsPer100g * 10) / 10,
        fatPer100g: Math.round(f.fatPer100g * 10) / 10,
      })),
    };
  }
}

