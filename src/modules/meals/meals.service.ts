import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { MealsRepository } from './meals.repository';
import { CreateMealDto } from './dto/create-meal.dto';
import { getVietnamDayRange } from '../../common/utils/date.util';

export interface DailyMealsSummary {
  date: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  mealCount: number;
}

export interface DailyMealsResponse {
  date: string;
  summary: DailyMealsSummary;
  meals: any[];
}

@Injectable()
export class MealsService {
  private readonly logger = new Logger(MealsService.name);

  constructor(private readonly mealsRepository: MealsRepository) {}

  async createMeal(userId: string, dto: CreateMealDto) {
    this.logger.log(`Logging meal '${dto.name || dto.mealType}' for user ${userId}`);
    return this.mealsRepository.create(userId, dto);
  }

  async getMealsByUser(userId: string) {
    return this.mealsRepository.findByUserId(userId);
  }

  async getDailyMeals(userId: string, dateStr?: string): Promise<DailyMealsResponse> {
    let dayRange;
    try {
      dayRange = getVietnamDayRange(dateStr);
    } catch (error: any) {
      throw new BadRequestException(error.message);
    }

    const { dateString, startUtc, endUtc, loggedDate } = dayRange;
    const meals = await this.mealsRepository.findByUserAndDate(
      userId,
      loggedDate,
      startUtc,
      endUtc,
    );

    const summary: DailyMealsSummary = meals.reduce(
      (acc, meal) => {
        acc.totalCalories += meal.totalCalories;
        acc.totalProtein += meal.totalProtein;
        acc.totalCarbs += meal.totalCarbs;
        acc.totalFat += meal.totalFat;
        acc.mealCount += 1;
        return acc;
      },
      {
        date: dateString,
        totalCalories: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFat: 0,
        mealCount: 0,
      },
    );

    // Round values to 1 decimal place
    summary.totalCalories = Math.round(summary.totalCalories);
    summary.totalProtein = Math.round(summary.totalProtein * 10) / 10;
    summary.totalCarbs = Math.round(summary.totalCarbs * 10) / 10;
    summary.totalFat = Math.round(summary.totalFat * 10) / 10;

    return {
      date: dateString,
      summary,
      meals,
    };
  }

  async getMealById(userId: string, mealId: string) {
    const meal = await this.mealsRepository.findById(mealId);
    if (!meal) {
      throw new NotFoundException(`Meal with ID '${mealId}' not found.`);
    }
    if (meal.userId !== userId) {
      throw new ForbiddenException('You do not have permission to view this meal.');
    }
    return meal;
  }

  async deleteMeal(userId: string, mealId: string) {
    const meal = await this.getMealById(userId, mealId);
    await this.mealsRepository.delete(meal.id);
    return {
      success: true,
      message: `Meal '${meal.name || meal.mealType}' deleted successfully.`,
    };
  }
}
