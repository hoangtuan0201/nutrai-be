import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { AdminPaginationDto } from '../../common/pagination';

export class QueryAdminPaymentsDto extends AdminPaginationDto {
  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;
}

export const PAYMENT_EVENT_STATUSES = ['PROCESSED', 'IGNORED', 'FAILED'] as const;

export class QueryPaymentEventsDto extends AdminPaginationDto {
  @ApiPropertyOptional({ example: 'SEPAY', description: 'SEPAY | STRIPE | MANUAL' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  provider?: string;

  @ApiPropertyOptional({ enum: PAYMENT_EVENT_STATUSES })
  @IsOptional()
  @IsIn(PAYMENT_EVENT_STATUSES)
  status?: (typeof PAYMENT_EVENT_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentId?: string;
}

export class ManualActivateDto {
  @ApiPropertyOptional({ example: 'Khách chuyển khoản lúc 10:32, QR hết hạn lúc 10:30' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({ description: 'Bank transaction reference used for reconciliation' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankReference?: string;
}

