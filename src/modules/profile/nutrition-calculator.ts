import { ActivityLevel, FitnessGoal, Gender } from '@prisma/client';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Mifflin-St Jeor activity multipliers */
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  [ActivityLevel.SEDENTARY]: 1.2,       // Little/no exercise
  [ActivityLevel.LIGHT]: 1.375,         // Light exercise 1-3 days/week
  [ActivityLevel.MODERATE]: 1.55,       // Moderate exercise 3-5 days/week
  [ActivityLevel.VERY_ACTIVE]: 1.725,   // Hard exercise 6-7 days/week
  [ActivityLevel.EXTRA_ACTIVE]: 1.9,    // Very hard exercise + physical job
};

/** Daily calorie delta per fitness goal */
export const GOAL_CALORIE_DELTA: Record<FitnessGoal, number> = {
  [FitnessGoal.WEIGHT_LOSS]: -500,  // ~0.5 kg/week deficit
  [FitnessGoal.MAINTENANCE]: 0,
  [FitnessGoal.MUSCLE_GAIN]: +300,  // lean bulk surplus
};

/** Macro ratios (% of calories). Protein & Carbs = 4 kcal/g, Fat = 9 kcal/g */
export const MACRO_RATIOS: Record<FitnessGoal, { protein: number; carb: number; fat: number }> = {
  [FitnessGoal.WEIGHT_LOSS]: { protein: 0.35, carb: 0.35, fat: 0.30 },
  [FitnessGoal.MAINTENANCE]: { protein: 0.25, carb: 0.50, fat: 0.25 },
  [FitnessGoal.MUSCLE_GAIN]: { protein: 0.30, carb: 0.45, fat: 0.25 },
};

export const MIN_SAFE_CALORIES = 1200;

// ─── Pure calculation functions ───────────────────────────────────────────────

/**
 * BMR via Mifflin-St Jeor formula.
 *
 * Male:   10W + 6.25H − 5A + 5
 * Female: 10W + 6.25H − 5A − 161
 * Other:  average → 10W + 6.25H − 5A − 78
 */
export function calculateBMR(
  weightKg: number,
  heightCm: number,
  ageYears: number,
  gender: Gender,
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  const offset = gender === Gender.MALE ? 5 : gender === Gender.FEMALE ? -161 : -78;
  return Math.round((base + offset) * 100) / 100;
}

/** TDEE = BMR × activity multiplier */
export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel] * 100) / 100;
}

/** Calorie target (TDEE ± goal delta, floored at MIN_SAFE_CALORIES) + macro grams */
export function calculateTargets(
  tdee: number,
  goal: FitnessGoal,
  weightKg?: number,
  gender?: Gender,
): { calorieTarget: number; proteinG: number; carbsG: number; fatG: number } {
  let minSafe = MIN_SAFE_CALORIES;
  if (gender === Gender.MALE) minSafe = 1500;
  else if (gender === Gender.FEMALE) minSafe = 1200;

  const delta = GOAL_CALORIE_DELTA[goal] ?? 0;
  const calorieTarget = Math.round(Math.max(minSafe, tdee + delta));

  if (weightKg && weightKg > 0) {
    const proteinG = Math.round(weightKg * 1.8);
    const fatG = Math.round(weightKg * 0.9);
    const remainingKcal = calorieTarget - (proteinG * 4 + fatG * 9);
    const carbsG = Math.round(Math.max(30, remainingKcal / 4));

    return {
      calorieTarget,
      proteinG,
      carbsG,
      fatG,
    };
  }

  const { protein, carb, fat } = MACRO_RATIOS[goal];

  return {
    calorieTarget,
    proteinG: Math.round((calorieTarget * protein) / 4),
    carbsG:   Math.round((calorieTarget * carb)    / 4),
    fatG:     Math.round((calorieTarget * fat)      / 9),
  };
}

/** Age in full years from date-of-birth */
export function ageFromDob(dob: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}
