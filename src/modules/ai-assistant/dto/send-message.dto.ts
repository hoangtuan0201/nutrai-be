import { IsString, IsNotEmpty, IsOptional, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({
    description: 'User message or question for the NutraAI Coach',
    example: 'How much protein do I still need today?',
  })
  @IsString()
  @IsNotEmpty({ message: 'Message cannot be empty.' })
  @MaxLength(2000, { message: 'Message cannot exceed 2000 characters.' })
  message: string;

  @ApiPropertyOptional({
    description: 'Optional active conversation ID to continue an existing thread',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'conversationId must be a valid UUID.' })
  conversationId?: string;

  @ApiPropertyOptional({
    description: 'Optional base64-encoded food image attached in AI Coach chat',
  })
  @IsOptional()
  @IsString()
  imageBase64?: string;

  @ApiPropertyOptional({
    description: 'Optional MIME type of the attached image (e.g. image/jpeg, image/png)',
    example: 'image/jpeg',
  })
  @IsOptional()
  @IsString()
  mimeType?: string;
}
