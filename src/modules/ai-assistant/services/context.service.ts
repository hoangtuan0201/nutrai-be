import { Injectable } from '@nestjs/common';
import {
  getVietnamDayRange,
  getVietnamDateStringDaysAgo,
} from '../../../common/utils/date.util';
import { AiAssistantRepository } from '../ai-assistant.repository';
import {
  FullAiContextSnapshot,
  ProgressTrendContext,
  TodayNutritionContext,
  UserProfileContext,
} from '../interfaces/ai-assistant.interface';

@Injectable()
export class ContextService {
  constructor(private readonly repository: AiAssistantRepository) {}

  /**
   * Layer 1 (Direct Context Injection):
   * Builds a structured snapshot of Today's Nutrition, User Profile, and 7-Day Progress Trends
   */
  async buildUserNutritionContext(userId: string): Promise<FullAiContextSnapshot> {
    const todayRange = getVietnamDayRange();
    const sevenDaysAgoRange = getVietnamDayRange(getVietnamDateStringDaysAgo(6));

    const { user, profile, activeTarget, recentMeals, recentWeightLogs } =
      await this.repository.fetchUserNutritionRawData(
        userId,
        sevenDaysAgoRange.loggedDate,
        todayRange.loggedDate,
      );

    // 1. Compute Today's Nutrition
    const todayDateStr = todayRange.dateString;
    const todayMealsRaw = recentMeals.filter(
      (m) => m.loggedDate.toISOString().split('T')[0] === todayDateStr,
    );

    let caloriesConsumed = 0;
    let proteinConsumed = 0;
    let carbsConsumed = 0;
    let fatConsumed = 0;

    const todayMealsFormatted = todayMealsRaw.map((m) => {
      caloriesConsumed += m.totalCalories || 0;
      proteinConsumed += m.totalProtein || 0;
      carbsConsumed += m.totalCarbs || 0;
      fatConsumed += m.totalFat || 0;

      return {
        id: m.id,
        mealType: m.mealType,
        name: m.name || m.mealType,
        calories: Math.round(m.totalCalories || 0),
        protein: Math.round((m.totalProtein || 0) * 10) / 10,
        carbs: Math.round((m.totalCarbs || 0) * 10) / 10,
        fat: Math.round((m.totalFat || 0) * 10) / 10,
        items: (m.items || []).map(
          (it) => `${it.foodName} (${Math.round(it.calories)} kcal, ${Math.round(it.protein)}g P)`,
        ),
      };
    });

    const caloriesTarget = Math.round(activeTarget?.dailyCalories ?? 2000);
    const proteinTarget = Math.round(activeTarget?.dailyProtein ?? 120);
    const carbsTarget = Math.round(activeTarget?.dailyCarbs ?? 220);
    const fatTarget = Math.round(activeTarget?.dailyFat ?? 65);

    const roundedCaloriesConsumed = Math.round(caloriesConsumed);

    const todayNutrition: TodayNutritionContext = {
      date: todayDateStr,
      caloriesConsumed: roundedCaloriesConsumed,
      caloriesTarget,
      caloriesRemaining: Math.max(0, caloriesTarget - roundedCaloriesConsumed),
      proteinConsumed: Math.round(proteinConsumed * 10) / 10,
      proteinTarget,
      carbsConsumed: Math.round(carbsConsumed * 10) / 10,
      carbsTarget,
      fatConsumed: Math.round(fatConsumed * 10) / 10,
      fatTarget,
      mealsLoggedCount: todayMealsFormatted.length,
      meals: todayMealsFormatted,
    };

    // 2. Compute User Profile Context
    const latestWeightKg = recentWeightLogs[0]?.weightKg ?? profile?.weightKg ?? null;
    const heightCm = profile?.heightCm ?? null;
    let bmi: number | null = null;
    if (latestWeightKg && heightCm && heightCm > 0) {
      const hM = heightCm / 100;
      bmi = Math.round((latestWeightKg / (hM * hM)) * 10) / 10;
    }

    let age: number | null = null;
    if (profile?.dateOfBirth) {
      const dob = new Date(profile.dateOfBirth);
      const diffMs = Date.now() - dob.getTime();
      age = Math.max(10, Math.floor(diffMs / (365.25 * 24 * 3600 * 1000)));
    }

    const profileContext: UserProfileContext = {
      name: user?.name || user?.email?.split('@')[0] || 'User',
      gender: profile?.gender ?? null,
      age,
      heightCm,
      currentWeightKg: latestWeightKg,
      targetWeightKg: profile?.targetWeightKg ?? null,
      bmi,
      activityLevel: profile?.activityLevel ?? null,
      fitnessGoal: profile?.fitnessGoal ?? null,
    };

    // 3. Compute 7-Day Progress Trends
    const dailyMap = new Map<
      string,
      { calories: number; protein: number; carbs: number; fat: number }
    >();
    for (let i = 6; i >= 0; i--) {
      const dStr = getVietnamDateStringDaysAgo(i);
      dailyMap.set(dStr, { calories: 0, protein: 0, carbs: 0, fat: 0 });
    }

    for (const meal of recentMeals) {
      const dStr = meal.loggedDate.toISOString().split('T')[0];
      const bucket = dailyMap.get(dStr);
      if (bucket) {
        bucket.calories += meal.totalCalories || 0;
        bucket.protein += meal.totalProtein || 0;
        bucket.carbs += meal.totalCarbs || 0;
        bucket.fat += meal.totalFat || 0;
      }
    }

    const recentDailyCalories = Array.from(dailyMap.entries()).map(([date, totals]) => ({
      date,
      calories: Math.round(totals.calories),
      protein: Math.round(totals.protein * 10) / 10,
      carbs: Math.round(totals.carbs * 10) / 10,
      fat: Math.round(totals.fat * 10) / 10,
    }));

    const recentWeights = recentWeightLogs
      .slice(0, 7)
      .reverse()
      .map((w) => ({
        date: w.loggedDate.toISOString().split('T')[0],
        weightKg: Math.round(w.weightKg * 10) / 10,
        note: w.note,
      }));

    const progressContext: ProgressTrendContext = {
      recentWeights,
      recentDailyCalories,
    };

    return {
      todayNutrition,
      profile: profileContext,
      progress: progressContext,
    };
  }
}

