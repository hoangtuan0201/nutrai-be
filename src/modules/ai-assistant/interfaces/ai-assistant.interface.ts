export interface TodayMealSummaryItem {
  id: string;
  mealType: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  items: string[];
}

export interface TodayNutritionContext {
  date: string;
  caloriesConsumed: number;
  caloriesTarget: number;
  caloriesRemaining: number;
  proteinConsumed: number;
  proteinTarget: number;
  carbsConsumed: number;
  carbsTarget: number;
  fatConsumed: number;
  fatTarget: number;
  mealsLoggedCount: number;
  meals: TodayMealSummaryItem[];
}

export interface UserProfileContext {
  name: string;
  gender: string | null;
  age: number | null;
  heightCm: number | null;
  currentWeightKg: number | null;
  targetWeightKg: number | null;
  bmi: number | null;
  activityLevel: string | null;
  fitnessGoal: string | null;
}

export interface ProgressTrendContext {
  recentWeights: Array<{
    date: string;
    weightKg: number;
    note?: string | null;
  }>;
  recentDailyCalories: Array<{
    date: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }>;
}

export interface FullAiContextSnapshot {
  todayNutrition: TodayNutritionContext;
  profile: UserProfileContext;
  progress: ProgressTrendContext;
  attachedImageUrl?: string | null;
  toolsExecuted?: Array<{
    name: string;
    args: Record<string, any>;
    resultSummary: any;
  }>;
}

export interface ChatMessageItem {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  createdAt: string;
  latencyMs?: number | null;
  tokensUsed?: number | null;
  toolsUsed?: string[];
}

export interface AiAssistantContextResponse {
  todayNutrition: TodayNutritionContext;
  profile: UserProfileContext;
  activeConversation: {
    id: string | null;
    title: string | null;
    messages: ChatMessageItem[];
  };
}

export interface SendChatResponse {
  conversationId: string;
  userMessage: ChatMessageItem;
  assistantMessage: ChatMessageItem;
  todayNutrition: TodayNutritionContext;
  contextUpdated: boolean;
  quota?: {
    used: number;
    limit: number;
    remaining: number;
  };
}

