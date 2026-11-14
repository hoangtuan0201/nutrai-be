import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AdminPaginationDto } from '../../common/pagination';

/** ~5 MB image encoded as base64 data URI */
const MAX_IMAGE_DATA_URI_LENGTH = 7_000_000;
const IMAGE_DATA_URI_REGEX = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/;

export class CreateFoodDto {
  @ApiProperty({ example: 'Phở bò tái' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 120 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(900)
  caloriesPer100g: number;

  @ApiProperty({ example: 8 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  proteinPer100g: number;

  @ApiProperty({ example: 15 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  carbsPer100g: number;

  @ApiProperty({ example: 3 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  fatPer100g: number;

  @ApiPropertyOptional({ default: 'g', example: 'g' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  servingUnit?: string;

  @ApiPropertyOptional({ default: 100, description: 'Default serving size in servingUnit' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5000)
  defaultServingSize?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Image as data URI (png/jpeg/webp, max ~5MB); uploaded to Cloudinary' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_IMAGE_DATA_URI_LENGTH)
  @Matches(IMAGE_DATA_URI_REGEX, { message: 'imageBase64 must be a png/jpeg/webp data URI' })
  imageBase64?: string;
}

export class UpdateFoodDto extends PartialType(CreateFoodDto) {
  @ApiPropertyOptional({ description: 'Set true to remove the current image' })
  @IsOptional()
  @IsBoolean()
  removeImage?: boolean;
}

const toBoolean = ({ value }: { value: unknown }) =>
  value === undefined ? undefined : value === true || value === 'true';

export class QueryAdminFoodsDto extends AdminPaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isVerified?: boolean;
}

