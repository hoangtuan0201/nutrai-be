import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { GoogleLoginDto } from './dto/google-login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { Public } from '../../common/decorators/public.decorator';
import { IsString, IsNotEmpty } from 'class-validator';

class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

/**
 * AuthController
 *
 * POST /auth/google   — Exchange Firebase ID Token → internal JWT
 * POST /auth/refresh  — Exchange refresh token → new access token
 *
 * Note: No email/password endpoints — Google is the ONLY auth provider.
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in with Google (Firebase)',
    description:
      'Mobile app sends the Firebase ID Token obtained after Google Sign-In. ' +
      'NestJS verifies it server-side with Firebase Admin SDK and returns internal JWT tokens. ' +
      'The client must NOT be trusted to confirm its own authentication status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired Firebase ID token' })
  async loginWithGoogle(@Body() dto: GoogleLoginDto): Promise<AuthResponseDto> {
    return this.authService.loginWithGoogle(dto.idToken);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Exchange a valid refresh token for a new access token.',
  })
  @ApiResponse({ status: 200, description: 'New access token issued' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    try {
      return await this.authService.refreshToken(dto.refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }
}
