import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

/** Minutes since 00:00 (0..1439) */
export class UpdatePreferencesDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() notificationMealReminder?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() notificationGoalAlert?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() notificationAiRecommendation?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(1439) reminderBreakfastMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(1439) reminderLunchMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(1439) reminderDinnerMinutes?: number;
}

