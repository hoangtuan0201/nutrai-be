import { IsString, IsNotEmpty, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMealDto {
  @ApiProperty({ description: 'ID of the user logging the meal', example: 'user-uuid-1234' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Text-based description of the meal', example: 'Chicken breast with brown rice' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: 'Estimated calories of the meal (kcal)', example: 450 })
  @IsNumber()
  @Min(0)
  calories: number;

  @ApiProperty({ description: 'Estimated protein (g)', example: 35 })
  @IsNumber()
  @Min(0)
  protein: number;

  @ApiProperty({ description: 'Estimated carbs (g)', example: 40 })
  @IsNumber()
  @Min(0)
  carbs: number;

  @ApiProperty({ description: 'Estimated fat (g)', example: 8 })
  @IsNumber()
  @Min(0)
  fat: number;

  @ApiPropertyOptional({ description: 'AI recognition confidence score (0 to 1)', example: 0.95 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1)
  confidence?: number;
}
