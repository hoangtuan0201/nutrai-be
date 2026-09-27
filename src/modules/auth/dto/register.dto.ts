import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'alex@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({
    example: 'SecurePass@123',
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
  password: string;

  @ApiProperty({ example: 'Alex Johnson', required: false })
  @IsString()
  @MaxLength(100)
  name?: string;
}
