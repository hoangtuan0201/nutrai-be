import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { BillingPeriod } from '@prisma/client';

export enum CheckoutPaymentMethod {
  SEPAY = 'SEPAY',
  STRIPE = 'STRIPE',
}

export class CreateCheckoutDto {
  @ApiPropertyOptional({
    description: 'ID of the SubscriptionPlan. If omitted, resolved by billingPeriod (default MONTHLY Pro).',
    example: 'pro-monthly-uuid',
  })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({
    enum: BillingPeriod,
    default: BillingPeriod.MONTHLY,
    description: 'Billing period when planId is not explicitly provided',
  })
  @IsOptional()
  @IsEnum(BillingPeriod)
  billingPeriod?: BillingPeriod;

  @ApiProperty({
    enum: CheckoutPaymentMethod,
    default: CheckoutPaymentMethod.SEPAY,
    description: 'Payment gateway provider: SEPAY (VietQR) or STRIPE',
  })
  @IsOptional()
  @IsEnum(CheckoutPaymentMethod)
  paymentMethod?: CheckoutPaymentMethod = CheckoutPaymentMethod.SEPAY;

  @ApiPropertyOptional({
    description: 'Optional custom payment code (e.g. USERPRO for SePay Sandbox testing)',
    example: 'NUTRA12345',
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  customPaymentCode?: string;
}

