import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AdminPaginationDto } from '../../common/pagination';

export enum BroadcastAudience {
  ALL = 'ALL',
  FREE = 'FREE',
  INACTIVE_3D = 'INACTIVE_3D',
}

export class BroadcastNotificationDto {
  @ApiProperty({ example: 'Ưu đãi nâng cấp NutrAI Pro -20%' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title: string;

  @ApiProperty({ example: 'Nâng cấp gói Pro hôm nay để mở khóa AI Scan Food và AI Coach không giới hạn!' })
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  body: string;

  @ApiProperty({ enum: BroadcastAudience, default: BroadcastAudience.ALL })
  @IsEnum(BroadcastAudience)
  audience: BroadcastAudience = BroadcastAudience.ALL;

  @ApiPropertyOptional({ enum: NotificationType, default: NotificationType.SYSTEM })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType = NotificationType.SYSTEM;

  @ApiPropertyOptional({ example: '/settings/subscription', description: 'Optional deep-link route in mobile app' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  route?: string;
}

export class QueryBroadcastHistoryDto extends AdminPaginationDto {
  @ApiPropertyOptional({ enum: BroadcastAudience })
  @IsOptional()
  @IsEnum(BroadcastAudience)
  audience?: BroadcastAudience;
}

