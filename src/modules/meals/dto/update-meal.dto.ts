import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { MealType } from '@prisma/client';
import { CreateMealItemDto } from './create-meal.dto';

export class UpdateMealDto {
  @ApiPropertyOptional({ description: 'Custom name for this meal', example: 'Healthy breakfast' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Meal type', enum: MealType, example: 'BREAKFAST' })
  @IsEnum(MealType)
  @IsOptional()
  mealType?: MealType;

  @ApiPropertyOptional({ description: 'Total calories (kcal)', example: 450 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  totalCalories?: number;

  @ApiPropertyOptional({ description: 'Total protein (g)', example: 25 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  totalProtein?: number;

  @ApiPropertyOptional({ description: 'Total carbs (g)', example: 40 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  totalCarbs?: number;

  @ApiPropertyOptional({ description: 'Total fat (g)', example: 12 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  totalFat?: number;

  @ApiPropertyOptional({ description: 'Meal image URL' })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'List of food items in this meal', type: [CreateMealItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMealItemDto)
  @IsOptional()
  items?: CreateMealItemDto[];
}

