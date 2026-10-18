export interface DetectedFoodScanItem {
  name: string;
  caloriesPer100g: number;
  estimatedGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface FoodScanResponse {
  mealName: string;
  mealType: string;
  estimatedTotalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  confidence: number;
  advice?: string;
  items: DetectedFoodScanItem[];
}
