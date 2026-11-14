import { ApiPropertyOptional } from '@nestjs/swagger';
import { BillingPeriod } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class GrantProDto {
  @ApiPropertyOptional({
    enum: BillingPeriod,
    default: BillingPeriod.MONTHLY,
    description: 'Pro plan billing period to grant (MONTHLY = 30 days, YEARLY = 365 days by default)',
  })
  @IsOptional()
  @IsEnum(BillingPeriod)
  billingPeriod?: BillingPeriod = BillingPeriod.MONTHLY;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 3650,
    description: 'Optional custom duration in days (overrides default 30 or 365 days)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  durationDays?: number;
}

