import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn } from 'class-validator';

export class SearchFoodQueryDto {
  @ApiPropertyOptional({ description: 'Food keyword to search', example: 'chicken breast' })
  @IsString()
  @IsOptional()
  query?: string;

  @ApiPropertyOptional({
    description: 'Search data source: all (local + USDA), local, or usda',
    enum: ['all', 'local', 'usda'],
    default: 'all',
  })
  @IsOptional()
  @IsIn(['all', 'local', 'usda'])
  source?: 'all' | 'local' | 'usda' = 'all';
}
