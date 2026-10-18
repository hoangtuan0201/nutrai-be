import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MealType } from '@prisma/client';

export class ScanFoodDto {
  @ApiProperty({
    description: 'Base64-encoded image string (with or without data:image/... prefix)',
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
  })
  @IsString()
  @IsNotEmpty()
  imageBase64: string;

  @ApiPropertyOptional({
    description: 'MIME type of the image',
    example: 'image/jpeg',
    default: 'image/jpeg',
  })
  @IsString()
  @IsOptional()
  mimeType?: string;

  @ApiPropertyOptional({
    description: 'Meal type to associate this scan with',
    enum: MealType,
    example: 'LUNCH',
    default: 'LUNCH',
  })
  @IsEnum(MealType)
  @IsOptional()
  mealType?: MealType;

  @ApiPropertyOptional({
    description: 'Optional user-provided food description or hint to help AI identify accurately',
    example: 'Pho bo tai nam with broth and scallions',
  })
  @IsString()
  @IsOptional()
  foodHint?: string;
}
