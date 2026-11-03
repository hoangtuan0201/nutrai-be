import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ProgressQueryDto {
  @ApiPropertyOptional({ description: 'Number of days for history chart (default 7, e.g. 7, 14, 30)', default: 7 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(90)
  days?: number = 7;
}
