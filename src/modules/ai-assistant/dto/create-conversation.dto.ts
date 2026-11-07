import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateConversationDto {
  @ApiPropertyOptional({
    description: 'Optional title for the new conversation session',
    example: 'Weekly Meal Plan Discussion',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;
}

