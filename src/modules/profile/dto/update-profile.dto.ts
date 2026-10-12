import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsNumber,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { ActivityLevel, FitnessGoal, Gender } from '@prisma/client';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'Date of birth (ISO 8601 date string)',
    example: '1995-05-15',
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: Gender, example: Gender.MALE })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ description: 'Height in centimetres', example: 170 })
  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(300)
  heightCm?: number;

  @ApiPropertyOptional({ description: 'Weight in kilograms', example: 70 })
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(500)
  weightKg?: number;

  @ApiPropertyOptional({ enum: ActivityLevel, example: ActivityLevel.MODERATE })
  @IsOptional()
  @IsEnum(ActivityLevel)
  activityLevel?: ActivityLevel;

  @ApiPropertyOptional({ enum: FitnessGoal, example: FitnessGoal.WEIGHT_LOSS })
  @IsOptional()
  @IsEnum(FitnessGoal)
  fitnessGoal?: FitnessGoal;

  @ApiPropertyOptional({ description: 'Target daily calories', example: 2100 })
  @IsOptional()
  @IsNumber()
  @Min(800)
  dailyCalories?: number;

  @ApiPropertyOptional({ description: 'Target daily protein in grams', example: 126 })
  @IsOptional()
  @IsNumber()
  @Min(20)
  dailyProtein?: number;

  @ApiPropertyOptional({ description: 'Target daily carbs in grams', example: 250 })
  @IsOptional()
  @IsNumber()
  @Min(20)
  dailyCarbs?: number;

  @ApiPropertyOptional({ description: 'Target daily fat in grams', example: 63 })
  @IsOptional()
  @IsNumber()
  @Min(10)
  dailyFat?: number;
}
