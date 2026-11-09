import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class TestStreakRescueDto {
  @ApiPropertyOptional({
    description: 'If true, forcefully dispatches push regardless of time of day or current streak',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @ApiPropertyOptional({
    description: 'Simulated streak count (days) to display in notification when user has < 2 days',
    default: 3,
  })
  @IsOptional()
  @IsInt()
  @Min(2)
  simulatedStreak?: number;
}

export class TestWeeklyWeighInDto {
  @ApiPropertyOptional({
    description: 'If true, forcefully dispatches push regardless of whether today is Monday 07:30',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class TestMealReminderDto {
  @ApiProperty({
    description: 'The meal slot to test',
    enum: ['BREAKFAST', 'LUNCH', 'DINNER'],
    example: 'BREAKFAST',
  })
  @IsEnum(['BREAKFAST', 'LUNCH', 'DINNER'])
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER';

  @ApiPropertyOptional({
    description: 'If true, force dispatch even if meal was already logged today',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

