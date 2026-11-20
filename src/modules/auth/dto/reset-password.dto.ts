import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class VerifyResetCodeDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '482910', description: '6-digit password reset code sent via email' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'Reset code must be a 6-digit number' })
  code: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '482910', description: '6-digit password reset code sent via email' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'Reset code must be a 6-digit number' })
  code: string;

  @ApiProperty({
    example: 'NewStrongPass@123',
    minLength: 8,
    maxLength: 64,
    description:
      'At least 8 characters, must contain uppercase, lowercase, number, and special character',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(64, { message: 'Password must not exceed 64 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  newPassword: string;
}

