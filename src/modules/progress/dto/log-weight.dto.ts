import { IsNumber, IsOptional, IsString, IsDateString, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LogWeightDto {
  @ApiProperty({ description: 'Weight in kg', example: 68.5 })
  @IsNumber()
  @Min(20)
  @Max(300)
  weightKg: number;

  @ApiPropertyOptional({ description: 'Optional note for this weight check-in', example: 'Morning fasting' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ description: 'Date in YYYY-MM-DD format, defaults to today', example: '2026-10-28' })
  @IsDateString()
  @IsOptional()
  loggedDate?: string;
}
