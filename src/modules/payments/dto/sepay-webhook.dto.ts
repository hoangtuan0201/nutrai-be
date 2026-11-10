import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

/**
 * Supports both:
 * 1. SePay Standard Webhook Payload (transferAmount, content, transferType, accountNumber, referenceCode, gateway)
 * 2. SePay User API v2 Transaction Payload (amount_in, transaction_content, transfer_type, account_number, reference_number, bank_brand_name)
 */
export class SePayWebhookDto {
  @ApiPropertyOptional({ example: 'd225a75c-dc30-11f1-8895-0afffe87053b' })
  @IsOptional()
  id?: string | number;

  // --- Standard SePay Webhook fields ---
  @ApiPropertyOptional({ example: 'MBBank' })
  @IsOptional()
  @IsString()
  gateway?: string;

  @ApiPropertyOptional({ example: '2026-11-09 18:29:26' })
  @IsOptional()
  @IsString()
  transactionDate?: string;

  @ApiPropertyOptional({ example: '0899223595' })
  @IsOptional()
  @IsString()
  accountNumber?: string;

  @ApiPropertyOptional({ example: 'NUTRA12345' })
  @IsOptional()
  @IsString()
  code?: string | null;

  @ApiPropertyOptional({ example: 'NUTRA12345' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ example: 'in' })
  @IsOptional()
  @IsString()
  transferType?: string;

  @ApiPropertyOptional({ example: 49000 })
  @IsOptional()
  @IsNumber()
  transferAmount?: number;

  @ApiPropertyOptional({ example: 49000 })
  @IsOptional()
  @IsNumber()
  accumulated?: number;

  @ApiPropertyOptional({ example: null })
  @IsOptional()
  @IsString()
  subAccount?: string | null;

  @ApiPropertyOptional({ example: 'SB36555440D7D5' })
  @IsOptional()
  @IsString()
  referenceCode?: string;

  @ApiPropertyOptional({ example: '' })
  @IsOptional()
  @IsString()
  description?: string;

  // --- SePay API v2 Transaction fields ---
  @ApiPropertyOptional({ example: 'MBBank' })
  @IsOptional()
  @IsString()
  bank_brand_name?: string;

  @ApiPropertyOptional({ example: '0899223595' })
  @IsOptional()
  @IsString()
  account_number?: string;

  @ApiPropertyOptional({ example: '2026-11-09 18:29:26' })
  @IsOptional()
  @IsString()
  transaction_date?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  amount_out?: number;

  @ApiPropertyOptional({ example: 49000 })
  @IsOptional()
  @IsNumber()
  amount_in?: number;

  @ApiPropertyOptional({ example: 'USERPRO' })
  @IsOptional()
  @IsString()
  transaction_content?: string;

  @ApiPropertyOptional({ example: 'SB36555440D7D5' })
  @IsOptional()
  @IsString()
  reference_number?: string;

  @ApiPropertyOptional({ example: 'in' })
  @IsOptional()
  @IsString()
  transfer_type?: string;

  @ApiPropertyOptional({ example: '92e07ab0-dc30-11f1-8895-0afffe87053b' })
  @IsOptional()
  @IsString()
  bank_account_id?: string;
}

