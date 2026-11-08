import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UploadAvatarDto {
  @ApiProperty({ description: 'Base64 image (with or without data: prefix)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(14_000_000) // ~10MB binary
  imageBase64: string;
}

