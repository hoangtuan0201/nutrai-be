import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RegisterDeviceTokenDto {
  @ApiProperty({ example: 'fcm_or_expo_push_token_string' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ enum: ['ANDROID', 'IOS'], example: 'ANDROID' })
  @IsString()
  @IsIn(['ANDROID', 'IOS'])
  platform: 'ANDROID' | 'IOS';

  @ApiPropertyOptional({ example: 'Samsung Galaxy S24' })
  @IsOptional()
  @IsString()
  deviceModel?: string;
}

export class RemoveDeviceTokenDto {
  @ApiProperty({ example: 'fcm_or_expo_push_token_string' })
  @IsString()
  @IsNotEmpty()
  token: string;
}

