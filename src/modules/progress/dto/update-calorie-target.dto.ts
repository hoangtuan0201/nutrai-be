import { IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCalorieTargetDto {
  @ApiProperty({ description: 'Daily calorie intake target in kcal', example: 2000 })
  @Type(() => Number)
  @IsNumber()
  @Min(800)
  @Max(8000)
  dailyCalories: number;
}
