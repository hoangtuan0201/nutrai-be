import { Injectable, Logger } from '@nestjs/common';
import { ProgressRepository } from './progress.repository';
import { LogWeightDto } from './dto/log-weight.dto';
import {
  getVietnamDayRange,
  getVietnamTodayString,
  getVietnamDateStringDaysAgo,
} from '../../common/utils/date.util';
import { recalculateTargetWithWeightChange } from '../profile/nutrition-calculator';

export interface DailyMacroSummary {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealCount: number;
}

export interface WeightDataPoint {
  id?: string;
  date: string;
  dateTime?: string;
  weightKg: number;
  changeKg?: number;
  note?: string;
}

export interface ProgressSummaryResponse {
  bmi: {
    value: number;
    category: 'Severe Thinness' | 'Underweight' | 'Normal' | 'Overweight' | 'Obese';
    minHealthyWeightKg: number;
    maxHealthyWeightKg: number;
  };
  weight: {
    currentKg: number;
    targetKg: number;
    startKg?: number;
    changeKg: number;
    history: WeightDataPoint[];
  };
  calorieIntake: {
    targetCalories: number;
    targetProtein: number;
    targetCarbs: number;
    targetFat: number;
    history: DailyMacroSummary[];
    averageCalories: number;
  };
  streak: {
    currentStreakDays: number;
  };
}

@Injectable()
export class ProgressService {
  private readonly logger = new Logger(ProgressService.name);

  constructor(private readonly progressRepository: ProgressRepository) {}

  async getProgressOverview(userId: string, days = 7): Promise<ProgressSummaryResponse> {
    const { profile, target } = await this.progressRepository.getUserProfileAndTarget(userId);

    // Weight history (sorted desc: newest first)
    const weightLogs = await this.progressRepository.getWeightLogs(userId, 30);

    const heightM = (profile?.heightCm || 170) / 100;
    const currentWeight = weightLogs.length > 0 ? weightLogs[0].weightKg : (profile?.weightKg || 65);
    const targetWeight = profile?.targetWeightKg || currentWeight;

    // BMI calculation & categorization
    const bmiVal = Math.round((currentWeight / (heightM * heightM)) * 10) / 10;
    let bmiCategory: ProgressSummaryResponse['bmi']['category'] = 'Normal';
    if (bmiVal < 16) bmiCategory = 'Severe Thinness';
    else if (bmiVal < 18.5) bmiCategory = 'Underweight';
    else if (bmiVal <= 24.9) bmiCategory = 'Normal';
    else if (bmiVal <= 29.9) bmiCategory = 'Overweight';
    else bmiCategory = 'Obese';

    const minHealthyWeight = Math.round(18.5 * heightM * heightM * 10) / 10;
    const maxHealthyWeight = Math.round(24.9 * heightM * heightM * 10) / 10;

    const weightHistory: WeightDataPoint[] = weightLogs.map((log, index) => {
      const prevLog = weightLogs[index + 1];
      const changeKg = prevLog
        ? Math.round((log.weightKg - prevLog.weightKg) * 10) / 10
        : undefined;
      return {
        id: log.id,
        date: new Date(log.loggedDate).toISOString().split('T')[0],
        dateTime: log.createdAt.toISOString(),
        weightKg: log.weightKg,
        changeKg,
        note: log.note || undefined,
      };
    });

    // If no weight logs recorded yet, add current weight as initial point
    if (weightHistory.length === 0) {
      const now = new Date();
      const todayStr = getVietnamTodayString();
      weightHistory.push({
        date: todayStr,
        dateTime: now.toISOString(),
        weightKg: currentWeight,
        changeKg: 0,
      });
    }

    const startWeight = weightHistory[weightHistory.length - 1]?.weightKg || currentWeight;
    const weightChange = Math.round((currentWeight - startWeight) * 10) / 10;

    // Daily Macro history for the requested number of days in Asia/Ho_Chi_Minh timezone
    const startDateStr = getVietnamDateStringDaysAgo(days - 1);
    const endDateStr = getVietnamTodayString();

    const { loggedDate: startLoggedDate } = getVietnamDayRange(startDateStr);
    const { loggedDate: endLoggedDate } = getVietnamDayRange(endDateStr);

    const meals = await this.progressRepository.getMealsInRange(userId, startLoggedDate, endLoggedDate);

    // Group meals by loggedDate YYYY-MM-DD
    const mealsByDate = new Map<string, typeof meals>();
    for (const meal of meals) {
      const dateKey = new Date(meal.loggedDate).toISOString().split('T')[0];
      if (!mealsByDate.has(dateKey)) {
        mealsByDate.set(dateKey, []);
      }
      mealsByDate.get(dateKey)!.push(meal);
    }

    const intakeHistory: DailyMacroSummary[] = [];
    let totalCalsSum = 0;
    let daysWithLogs = 0;

    for (let i = days - 1; i >= 0; i--) {
      const dateKey = getVietnamDateStringDaysAgo(i);

      const dayMeals = mealsByDate.get(dateKey) || [];
      const dayCals = Math.round(dayMeals.reduce((acc, m) => acc + m.totalCalories, 0));
      const dayP = Math.round(dayMeals.reduce((acc, m) => acc + m.totalProtein, 0) * 10) / 10;
      const dayC = Math.round(dayMeals.reduce((acc, m) => acc + m.totalCarbs, 0) * 10) / 10;
      const dayF = Math.round(dayMeals.reduce((acc, m) => acc + m.totalFat, 0) * 10) / 10;

      if (dayMeals.length > 0) {
        daysWithLogs++;
        totalCalsSum += dayCals;
      }

      intakeHistory.push({
        date: dateKey,
        calories: dayCals,
        protein: dayP,
        carbs: dayC,
        fat: dayF,
        mealCount: dayMeals.length,
      });
    }

    const averageCalories = daysWithLogs > 0 ? Math.round(totalCalsSum / daysWithLogs) : 0;

    // Calculate consecutive logging streak with early termination (blazingly fast & uncapped)
    const currentStreakDays = await this.calculateConsecutiveStreak(userId);

    return {
      bmi: {
        value: bmiVal,
        category: bmiCategory,
        minHealthyWeightKg: minHealthyWeight,
        maxHealthyWeightKg: maxHealthyWeight,
      },
      weight: {
        currentKg: currentWeight,
        targetKg: targetWeight,
        startKg: startWeight,
        changeKg: weightChange,
        history: weightHistory,
      },
      calorieIntake: {
        targetCalories: target?.dailyCalories || 2000,
        targetProtein: target?.dailyProtein || 130,
        targetCarbs: target?.dailyCarbs || 220,
        targetFat: target?.dailyFat || 65,
        history: intakeHistory,
        averageCalories,
      },
      streak: {
        currentStreakDays,
      },
    };
  }

  async logWeight(userId: string, dto: LogWeightDto) {
    this.logger.log(`Logging weight ${dto.weightKg}kg for user ${userId}`);
    const { profile: oldProfile, target: existingTarget } =
      await this.progressRepository.getUserProfileAndTarget(userId);

    const logResult = await this.progressRepository.createOrUpdateWeightLog(userId, dto);

    const { profile: newProfile } =
      await this.progressRepository.getUserProfileAndTarget(userId);

    if (newProfile && newProfile.weightKg !== oldProfile?.weightKg) {
      const recalculated = recalculateTargetWithWeightChange(
        oldProfile,
        newProfile,
        existingTarget,
        false,
      );

      if (recalculated) {
        await this.progressRepository.upsertNutritionTarget(
          userId,
          recalculated,
          newProfile.fitnessGoal || 'MAINTENANCE',
        );
      }
    }

    return logResult;
  }

  async getWeightHistory(userId: string) {
    return this.progressRepository.getWeightLogs(userId, 60);
  }

  async updateCalorieTarget(userId: string, dailyCalories: number) {
    this.logger.log(`Updating daily calorie target to ${dailyCalories} for user ${userId}`);
    const { profile } = await this.progressRepository.getUserProfileAndTarget(userId);
    const weightKg = profile?.weightKg || 60;
    const goal = profile?.fitnessGoal || 'BUILD_MUSCLE';

    // Calculate proportional macros (P ~ 1.8g/kg, F ~ 0.9g/kg, C = remaining)
    const dailyProtein = Math.round(weightKg * 1.8);
    const dailyFat = Math.round(weightKg * 0.9);
    const remainingCals = Math.max(120, dailyCalories - dailyProtein * 4 - dailyFat * 9);
    const dailyCarbs = Math.round(remainingCals / 4);

    const target = await this.progressRepository.upsertNutritionTarget(
      userId,
      {
        dailyCalories,
        dailyProtein,
        dailyCarbs,
        dailyFat,
      },
      goal,
    );

    return {
      dailyCalories: target.dailyCalories,
      dailyProtein: target.dailyProtein,
      dailyCarbs: target.dailyCarbs,
      dailyFat: target.dailyFat,
      effectiveFrom: target.effectiveFrom.toISOString().split('T')[0],
    };
  }

  /**
   * Calculates uninterrupted consecutive logging streak ending today or yesterday.
   * Optimized with distinct dates and early termination (no 365-day cap, zero memory bloat).
   */
  async calculateConsecutiveStreak(userId: string): Promise<number> {
    const todayStr = getVietnamTodayString();
    const { loggedDate: todayDate } = getVietnamDayRange(todayStr);

    // Only query dates up to today (ignoring future planned meals so streak isn't corrupted)
    const distinctDates = await this.progressRepository.getDistinctMealDates(userId, todayDate);
    if (!distinctDates || distinctDates.length === 0) return 0;

    const yesterdayStr = getVietnamDateStringDaysAgo(1);

    const latestDateStr = new Date(distinctDates[0].loggedDate).toISOString().split('T')[0];

    // If latest logged date is neither today nor yesterday, the streak is broken (0)
    let expectedDateStr: string;
    if (latestDateStr === todayStr) {
      expectedDateStr = todayStr;
    } else if (latestDateStr === yesterdayStr) {
      expectedDateStr = yesterdayStr;
    } else {
      return 0;
    }

    let currentStreakDays = 0;
    for (const record of distinctDates) {
      const dStr = new Date(record.loggedDate).toISOString().split('T')[0];
      if (dStr === expectedDateStr) {
        currentStreakDays++;
        const [y, m, d] = expectedDateStr.split('-').map(Number);
        expectedDateStr = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().split('T')[0];
      } else {
        // Discontinuity found, streak ends immediately
        break;
      }
    }

    return currentStreakDays;
  }
}
