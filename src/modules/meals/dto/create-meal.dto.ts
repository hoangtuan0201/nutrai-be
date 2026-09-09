import { IsString, IsNotEmpty, IsNumber, IsOptional, IsEnum, IsArray, ValidateNested, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateMealItemDto {
  @ApiProperty({ description: 'Name of the food item', example: 'Chicken breast' })
  @IsString()
  @IsNotEmpty()
  foodName: string;

  @ApiPropertyOptional({ description: 'Portion description', example: '150g' })
  @IsString()
  @IsOptional()
  portionDescription?: string;

  @ApiProperty({ description: 'Quantity', example: 1 })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({ description: 'Unit of measurement', example: 'serving' })
  @IsString()
  @IsNotEmpty()
  unit: string;

  @ApiProperty({ description: 'Calories (kcal)', example: 250 })
  @IsNumber()
  @Min(0)
  calories: number;

  @ApiProperty({ description: 'Protein (g)', example: 30 })
  @IsNumber()
  @Min(0)
  protein: number;

  @ApiProperty({ description: 'Carbs (g)', example: 5 })
  @IsNumber()
  @Min(0)
  carbs: number;

  @ApiProperty({ description: 'Fat (g)', example: 8 })
  @IsNumber()
  @Min(0)
  fat: number;
}

export class CreateMealDto {
  @ApiProperty({ description: 'ID of the user logging the meal' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Meal type', enum: ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'], example: 'LUNCH' })
  @IsEnum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'])
  mealType: string;

  @ApiPropertyOptional({ description: 'Custom name for this meal', example: 'Office lunch' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Total calories (kcal)', example: 650 })
  @IsNumber()
  @Min(0)
  totalCalories: number;

  @ApiProperty({ description: 'Total protein (g)', example: 48 })
  @IsNumber()
  @Min(0)
  totalProtein: number;

  @ApiProperty({ description: 'Total carbs (g)', example: 70 })
  @IsNumber()
  @Min(0)
  totalCarbs: number;

  @ApiProperty({ description: 'Total fat (g)', example: 18 })
  @IsNumber()
  @Min(0)
  totalFat: number;

  @ApiPropertyOptional({ description: 'Meal image URL' })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({ description: 'Meal source', enum: ['MANUAL', 'AI_TEXT', 'AI_IMAGE'], example: 'MANUAL' })
  @IsEnum(['MANUAL', 'AI_TEXT', 'AI_IMAGE'])
  source: string;

  @ApiPropertyOptional({ description: 'List of food items in this meal', type: [CreateMealItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMealItemDto)
  @IsOptional()
  items?: CreateMealItemDto[];
}
