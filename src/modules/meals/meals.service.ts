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
import { CloudinaryService } from '../../common/cloudinary/cloudinary.service';

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

  constructor(
    private readonly mealsRepository: MealsRepository,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async createMeal(userId: string, dto: CreateMealDto) {
    this.logger.log(`Logging meal '${dto.name || dto.mealType}' for user ${userId}`);

    // If imageUrl is a raw base64 string or data URI, upload it to Cloudinary
    if (dto.imageUrl && (dto.imageUrl.startsWith('data:') || dto.imageUrl.length > 500)) {
      try {
        const cdnUrl = await this.cloudinaryService.uploadImage(dto.imageUrl);
        dto.imageUrl = cdnUrl;
        this.logger.log(`Uploaded meal image to Cloudinary: ${cdnUrl}`);
      } catch (err: any) {
        this.logger.warn(`Failed to upload meal image to Cloudinary: ${err.message}. Keeping fallback/omitted.`);
        // Don't save gigantic base64 in DB if upload fails
        dto.imageUrl = undefined;
      }
    }

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
