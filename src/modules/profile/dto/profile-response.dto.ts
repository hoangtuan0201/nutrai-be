import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityLevel, FitnessGoal, Gender } from '@prisma/client';

export class NutritionTargetDto {
  @ApiProperty() dailyCalories: number;
  @ApiProperty() dailyProtein: number;
  @ApiProperty() dailyCarbs: number;
  @ApiProperty() dailyFat: number;
  @ApiProperty() effectiveFrom: string;
}

export class CalculatedMetricsDto {
  @ApiProperty({ description: 'Basal Metabolic Rate (kcal/day)' })
  bmr: number;

  @ApiProperty({ description: 'Total Daily Energy Expenditure (kcal/day)' })
  tdee: number;

  @ApiProperty({ description: 'Daily calorie target adjusted for goal' })
  calorieTarget: number;
}

export class ProfileResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;

  @ApiPropertyOptional() dateOfBirth?: string;
  @ApiPropertyOptional({ enum: Gender }) gender?: Gender;
  @ApiPropertyOptional() heightCm?: number;
  @ApiPropertyOptional() weightKg?: number;
  @ApiPropertyOptional({ enum: ActivityLevel }) activityLevel?: ActivityLevel;
  @ApiPropertyOptional({ enum: FitnessGoal }) fitnessGoal?: FitnessGoal;

  @ApiPropertyOptional({ type: CalculatedMetricsDto })
  metrics?: CalculatedMetricsDto;

  @ApiPropertyOptional({ type: NutritionTargetDto })
  activeTarget?: NutritionTargetDto;

  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
}
