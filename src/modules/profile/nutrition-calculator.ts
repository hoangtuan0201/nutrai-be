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
    // Body-weight based calculation: ~1.8 g/kg protein, ~0.9 g/kg fat, remainder carbs
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

export interface ProfileMetricsSnapshot {
  weightKg?: number | null;
  heightCm?: number | null;
  dateOfBirth?: Date | null;
  gender?: Gender | null;
  activityLevel?: ActivityLevel | null;
  fitnessGoal?: FitnessGoal | null;
}

/**
 * Recalculates daily calorie & macro targets when weight or profile metrics change.
 * - If the user had manually customized their calorie target (differs from old formula by > 5 kcal)
 *   and did NOT just change their fitnessGoal/activityLevel, keeps their exact custom dailyCalories
 *   while recalculating macro grams (Protein/Fat/Carbs) for the new body weight.
 * - Otherwise (when using formula target or when fitnessGoal/activityLevel changes), recalculates
 *   dailyCalories and macros automatically using the Mifflin-St Jeor formula.
 */
export function recalculateTargetWithWeightChange(
  oldProfile: ProfileMetricsSnapshot | null | undefined,
  newProfile: ProfileMetricsSnapshot | null | undefined,
  existingTarget: { dailyCalories: number } | null | undefined,
  resetCustomRatio = false,
): {
  dailyCalories: number;
  dailyProtein: number;
  dailyCarbs: number;
  dailyFat: number;
} | undefined {
  if (!newProfile?.weightKg || newProfile.weightKg <= 0) {
    return undefined;
  }

  const newWeight = newProfile.weightKg;
  const newGender = newProfile.gender ?? oldProfile?.gender ?? Gender.MALE;
  const newActivity = newProfile.activityLevel ?? oldProfile?.activityLevel ?? ActivityLevel.MODERATE;
  const newGoal = newProfile.fitnessGoal ?? oldProfile?.fitnessGoal ?? FitnessGoal.MAINTENANCE;
  const newHeight = newProfile.heightCm || oldProfile?.heightCm || 170;
  const newAge = newProfile.dateOfBirth
    ? ageFromDob(newProfile.dateOfBirth)
    : oldProfile?.dateOfBirth
    ? ageFromDob(oldProfile.dateOfBirth)
    : 25;

  const newBmr = calculateBMR(newWeight, newHeight, newAge, newGender);
  const newTdee = calculateTDEE(newBmr, newActivity);
  const newFormula = calculateTargets(newTdee, newGoal, newWeight, newGender);

  // Check if user had a custom manual calorie goal before this weight update
  if (!resetCustomRatio && existingTarget && existingTarget.dailyCalories > 0) {
    const oldWeight = oldProfile?.weightKg || newWeight;
    const oldHeight = oldProfile?.heightCm || newHeight;
    const oldGender = oldProfile?.gender ?? newGender;
    const oldActivity = oldProfile?.activityLevel ?? newActivity;
    const oldGoal = oldProfile?.fitnessGoal ?? newGoal;
    const oldAge = oldProfile?.dateOfBirth
      ? ageFromDob(oldProfile.dateOfBirth)
      : newAge;

    const oldBmr = calculateBMR(oldWeight, oldHeight, oldAge, oldGender);
    const oldTdee = calculateTDEE(oldBmr, oldActivity);
    const oldFormula = calculateTargets(oldTdee, oldGoal, oldWeight, oldGender);

    if (
      oldFormula.calorieTarget > 0 &&
      Math.abs(existingTarget.dailyCalories - oldFormula.calorieTarget) > 5
    ) {
      // User manually set a custom Calorie Goal: keep their exact dailyCalories unchanged,
      // and only recalculate macro grams for the new body weight.
      const dailyCalories = Math.round(existingTarget.dailyCalories);
      const dailyProtein = Math.round(newWeight * 1.8);
      const dailyFat = Math.round(newWeight * 0.9);
      const remainingKcal = dailyCalories - (dailyProtein * 4 + dailyFat * 9);
      const dailyCarbs = Math.round(Math.max(30, remainingKcal / 4));

      return { dailyCalories, dailyProtein, dailyCarbs, dailyFat };
    }
  }

  return {
    dailyCalories: newFormula.calorieTarget,
    dailyProtein: newFormula.proteinG,
    dailyCarbs: newFormula.carbsG,
    dailyFat: newFormula.fatG,
  };
}
