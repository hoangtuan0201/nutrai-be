import { ActivityLevel, FitnessGoal, Gender } from '@prisma/client';
import {
  calculateBMR,
  calculateTDEE,
  calculateTargets,
  ageFromDob,
  ACTIVITY_MULTIPLIERS,
  GOAL_CALORIE_DELTA,
  MACRO_RATIOS,
  MIN_SAFE_CALORIES,
} from './nutrition-calculator';

describe('NutritionCalculator', () => {
  describe('calculateBMR (Mifflin-St Jeor)', () => {
    it('should correctly calculate BMR for male', () => {
      // Weight: 70kg, Height: 175cm, Age: 25, Male
      // Formula: 10*70 + 6.25*175 - 5*25 + 5 = 700 + 1093.75 - 125 + 5 = 1673.75
      const bmr = calculateBMR(70, 175, 25, Gender.MALE);
      expect(bmr).toBe(1673.75);
    });

    it('should correctly calculate BMR for female', () => {
      // Weight: 55kg, Height: 160cm, Age: 30, Female
      // Formula: 10*55 + 6.25*160 - 5*30 - 161 = 550 + 1000 - 150 - 161 = 1239
      const bmr = calculateBMR(55, 160, 30, Gender.FEMALE);
      expect(bmr).toBe(1239);
    });

    it('should correctly calculate BMR for other gender (average offset)', () => {
      // Weight: 60kg, Height: 170cm, Age: 28, Other
      // Formula: 10*60 + 6.25*170 - 5*28 - 78 = 600 + 1062.5 - 140 - 78 = 1444.5
      const bmr = calculateBMR(60, 170, 28, Gender.OTHER);
      expect(bmr).toBe(1444.5);
    });
  });

  describe('calculateTDEE', () => {
    const bmr = 1500;

    it('should scale by SEDENTARY (1.2)', () => {
      expect(calculateTDEE(bmr, ActivityLevel.SEDENTARY)).toBe(1800);
    });

    it('should scale by LIGHT (1.375)', () => {
      expect(calculateTDEE(bmr, ActivityLevel.LIGHT)).toBe(2062.5);
    });

    it('should scale by MODERATE (1.55)', () => {
      expect(calculateTDEE(bmr, ActivityLevel.MODERATE)).toBe(2325);
    });

    it('should scale by VERY_ACTIVE (1.725)', () => {
      expect(calculateTDEE(bmr, ActivityLevel.VERY_ACTIVE)).toBe(2587.5);
    });

    it('should scale by EXTRA_ACTIVE (1.9)', () => {
      expect(calculateTDEE(bmr, ActivityLevel.EXTRA_ACTIVE)).toBe(2850);
    });
  });

  describe('calculateTargets', () => {
    it('should apply WEIGHT_LOSS deficit (-500 kcal) and correct macro ratios', () => {
      const tdee = 2200;
      const targets = calculateTargets(tdee, FitnessGoal.WEIGHT_LOSS);
      // Expected calories: 2200 - 500 = 1700
      expect(targets.calorieTarget).toBe(1700);
      // Protein: 35% of 1700 / 4 = 148.75 -> 149g
      expect(targets.proteinG).toBe(149);
      // Carbs: 35% of 1700 / 4 = 148.75 -> 149g
      expect(targets.carbsG).toBe(149);
      // Fat: 30% of 1700 / 9 = 56.67 -> 57g
      expect(targets.fatG).toBe(57);
    });

    it('should apply MAINTENANCE (0 delta) and correct macro ratios', () => {
      const tdee = 2000;
      const targets = calculateTargets(tdee, FitnessGoal.MAINTENANCE);
      expect(targets.calorieTarget).toBe(2000);
      // Protein: 25% of 2000 / 4 = 125g
      expect(targets.proteinG).toBe(125);
      // Carbs: 50% of 2000 / 4 = 250g
      expect(targets.carbsG).toBe(250);
      // Fat: 25% of 2000 / 9 = 55.56 -> 56g
      expect(targets.fatG).toBe(56);
    });

    it('should apply MUSCLE_GAIN surplus (+300 kcal) and correct macro ratios', () => {
      const tdee = 2000;
      const targets = calculateTargets(tdee, FitnessGoal.MUSCLE_GAIN);
      expect(targets.calorieTarget).toBe(2300);
      // Protein: 30% of 2300 / 4 = 172.5 -> 173g
      expect(targets.proteinG).toBe(173);
      // Carbs: 45% of 2300 / 4 = 258.75 -> 259g
      expect(targets.carbsG).toBe(259);
      // Fat: 25% of 2300 / 9 = 63.89 -> 64g
      expect(targets.fatG).toBe(64);
    });

    it('should enforce MIN_SAFE_CALORIES (1200 kcal floor)', () => {
      const lowTdee = 1400; // 1400 - 500 = 900, which is below 1200
      const targets = calculateTargets(lowTdee, FitnessGoal.WEIGHT_LOSS);
      expect(targets.calorieTarget).toBe(MIN_SAFE_CALORIES);
    });
  });

  describe('ageFromDob', () => {
    it('should calculate age correctly for past birthday this year', () => {
      const dob = new Date(1995, 0, 1); // Jan 1, 1995
      const age = ageFromDob(dob);
      expect(age).toBeGreaterThanOrEqual(30);
    });
  });
});
