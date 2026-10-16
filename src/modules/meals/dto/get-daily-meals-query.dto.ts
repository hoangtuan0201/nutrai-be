import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';
import { DATE_REGEX } from '../../../common/utils/date.util';

export class GetDailyMealsQueryDto {
  @ApiPropertyOptional({
    description: 'Calendar date in YYYY-MM-DD format (Asia/Ho_Chi_Minh timezone)',
    example: '2026-10-13',
  })
  @IsOptional()
  @Matches(DATE_REGEX, {
    message: 'Date must be a valid YYYY-MM-DD string (e.g. 2026-10-13)',
  })
  date?: string;
}
