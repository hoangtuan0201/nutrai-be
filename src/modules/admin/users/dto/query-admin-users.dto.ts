import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { Role } from '@prisma/client';
import { AdminPaginationDto } from '../../common/pagination';

export enum UserPlanFilter {
  FREE = 'FREE',
  PRO = 'PRO',
}

export class QueryAdminUsersDto extends AdminPaginationDto {
  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ enum: UserPlanFilter })
  @IsOptional()
  @IsEnum(UserPlanFilter)
  plan?: UserPlanFilter;
}

