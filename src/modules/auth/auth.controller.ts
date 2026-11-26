import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { GoogleLoginDto } from './dto/google-login.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto, VerifyResetCodeDto } from './dto/reset-password.dto';
import { ResendVerificationDto, VerifyEmailDto } from './dto/verify-email.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { Public } from '../../common/decorators/public.decorator';

/**
 * AuthController
 *
 * POST /auth/register        — Email + password registration
 * POST /auth/login           — Email + password login
 * POST /auth/google          — Google (Firebase) Sign-In
 * POST /auth/forgot-password — Initiate password reset
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Email / Password ─────────────────────────────────────────

  /**
   * POST /auth/register — Đăng ký tài khoản mới bằng Email & Password
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register with email and password' })
  @ApiResponse({ status: 201, description: 'Account created', type: AuthResponseDto })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto);
  }

  /**
   * POST /auth/login — Đăng nhập bằng Email & Password (trả về stateless JWT Access Token)
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  /**
   * POST /auth/forgot-password — Gửi mã 6 chữ số đặt lại mật khẩu qua email
   */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a 6-digit password reset code via email',
    description:
      'Always returns 200 regardless of whether the email exists (prevents user enumeration).',
  })
  @ApiResponse({ status: 200, description: 'Reset code sent if account exists' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  /**
   * POST /auth/verify-reset-code — Kiểm tra mã OTP đặt lại mật khẩu trước khi nhập mật khẩu mới
   */
  @Public()
  @Post('verify-reset-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify 6-digit password reset code before setting a new password' })
  @ApiResponse({ status: 200, description: 'Reset code is valid' })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset code' })
  async verifyResetCode(@Body() dto: VerifyResetCodeDto) {
    return this.authService.verifyResetCode(dto.email, dto.code);
  }

  /**
   * POST /auth/reset-password — Xác thực mã OTP và cập nhật mật khẩu mới
   */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using the 6-digit code sent via email' })
  @ApiResponse({ status: 200, description: 'Password updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset code' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.email, dto.code, dto.newPassword);
  }

  /**
   * POST /auth/verify-email — Xác thực email bằng mã OTP 6 chữ số
   */
  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email address using the 6-digit code' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired verification code' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.email, dto.code);
  }

  /**
   * POST /auth/resend-verification — Gửi lại mã xác thực email mới
   */
  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend a new 6-digit email verification code' })
  @ApiResponse({ status: 200, description: 'Verification code re-sent if account is unverified' })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerificationEmail(dto.email);
  }

  // ─── Google (Firebase) ────────────────────────────────────────

  /**
   * POST /auth/google — Đăng nhập bằng Google thông qua Firebase ID Token
   */
  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in with Google (Firebase ID Token)',
    description:
      'Mobile app sends the Firebase ID Token obtained after Google Sign-In. ' +
      'NestJS verifies it server-side with Firebase Admin SDK and returns internal JWT tokens.',
  })
  @ApiResponse({ status: 200, description: 'Authentication successful', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or expired Firebase ID token' })
  loginWithGoogle(@Body() dto: GoogleLoginDto): Promise<AuthResponseDto> {
    return this.authService.loginWithGoogle(dto.idToken);
  }
}
