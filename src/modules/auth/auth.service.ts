import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EventBus } from '@nestjs/cqrs';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { FirebaseAuthService } from '../firebase/firebase-auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PasswordResetRequestedEvent } from './events/password-reset-requested.event';
import { EmailVerificationRequestedEvent } from './events/email-verification-requested.event';
import { AuthRepository } from './auth.repository';
import {
  JwtPayload,
  issueTokens,
  generateOtpCode,
  safePasswordHash,
} from './auth.helpers';

// Re-export so JwtAuthGuard import path stays the same
export type { JwtPayload };

/**
 * AuthService — orchestrates:
 *   1. Google Sign-In (Firebase)
 *   2. Email/Password register & login
 *   3. Forgot-password token generation
 *   4. Refresh token → new access token
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly firebaseAuth: FirebaseAuthService,
    private readonly repo: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly eventBus: EventBus,
  ) {}

  // ─── 1. Google Sign-In ───────────────────────────────────────────

  async loginWithGoogle(idToken: string): Promise<AuthResponseDto> {
    const decoded = await this.firebaseAuth.verifyIdToken(idToken);
    const { user, isNewUser } = await this.repo.upsertGoogleUser(decoded);
    if (!user.isActive) {
      throw new UnauthorizedException('Your account has been deactivated');
    }
    const tokens = await issueTokens(this.jwtService, this.config, user.id, user.email, user.role);

    this.logger.log(`Google login: ${user.email} (${isNewUser ? 'NEW' : 'EXISTING'})`);
    return { tokens, isNewUser, user: toUserDto(user) };
  }

  // ─── 2. Register ─────────────────────────────────────────────────

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const email = dto.email.toLowerCase().trim();

    if (await this.repo.findByEmail(email)) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(
      dto.password,
      this.config.get<number>('auth.bcryptRounds') ?? 12,
    );

    const user = await this.repo.createEmailUser({ email, passwordHash, name: dto.name });

    // Generate 6-digit email verification OTP and dispatch asynchronously
    const verifyExpiresMin =
      this.config.get<number>('auth.emailVerificationExpiresMinutes') ?? 15;
    const verifyCode = generateOtpCode();
    const verifyExpiresAt = new Date(Date.now() + verifyExpiresMin * 60_000);
    await this.repo.setEmailVerificationCode(user.id, verifyCode, verifyExpiresAt);
    this.eventBus.publish(
      new EmailVerificationRequestedEvent(
        user.id,
        user.email,
        user.name,
        verifyCode,
        verifyExpiresAt,
      ),
    );

    const tokens = await issueTokens(this.jwtService, this.config, user.id, user.email, user.role);

    this.logger.log(`New registration: ${user.email}`);
    return { tokens, isNewUser: true, user: toUserDto(user) };
  }

  // ─── 2b. Verify Email & Resend Verification ──────────────────────

  async verifyEmail(email: string, code: string): Promise<{ message: string; emailVerified: boolean }> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.repo.findByEmailWithTokens(normalizedEmail);

    if (!user || !user.isActive) {
      throw new BadRequestException('Invalid verification code or email.');
    }

    if (user.emailVerified) {
      return { message: 'Email is already verified.', emailVerified: true };
    }

    if (
      !user.emailVerificationToken ||
      !user.emailVerificationExpires ||
      user.emailVerificationExpires.getTime() < Date.now()
    ) {
      throw new BadRequestException('Verification code has expired. Please request a new code.');
    }

    if (!safeCodeEqual(code.trim(), user.emailVerificationToken)) {
      throw new BadRequestException('Invalid verification code. Please check and try again.');
    }

    await this.repo.markEmailVerified(user.id);
    this.logger.log(`Email verified: ${user.email}`);
    return { message: 'Email verified successfully.', emailVerified: true };
  }

  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const SAFE_RESPONSE = {
      message: 'If your account exists and is unverified, a new 6-digit verification code has been sent.',
    };

    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.repo.findByEmailWithTokens(normalizedEmail);
    if (!user || !user.isActive || user.emailVerified || user.authProvider === 'GOOGLE') {
      return SAFE_RESPONSE;
    }

    const verifyExpiresMin =
      this.config.get<number>('auth.emailVerificationExpiresMinutes') ?? 15;
    const verifyCode = generateOtpCode();
    const verifyExpiresAt = new Date(Date.now() + verifyExpiresMin * 60_000);

    await this.repo.setEmailVerificationCode(user.id, verifyCode, verifyExpiresAt);
    this.eventBus.publish(
      new EmailVerificationRequestedEvent(
        user.id,
        user.email,
        user.name,
        verifyCode,
        verifyExpiresAt,
      ),
    );

    return SAFE_RESPONSE;
  }

  // ─── 3. Login ────────────────────────────────────────────────────

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.repo.findByEmail(email);

    // Always run bcrypt to prevent timing-attack enumeration
    const isValid = await bcrypt.compare(dto.password, safePasswordHash(user?.passwordHash));

    if (!user || !isValid) throw new UnauthorizedException('Invalid email or password');
    if (!user.isActive)    throw new UnauthorizedException('Your account has been deactivated');
    if (user.authProvider === 'GOOGLE' && !user.passwordHash) {
      throw new UnauthorizedException('This account uses Google Sign-In. Please sign in with Google.');
    }

    const tokens = await issueTokens(this.jwtService, this.config, user.id, user.email, user.role);
    this.logger.log(`Login: ${user.email}`);
    return { tokens, isNewUser: false, user: toUserDto(user) };
  }

  // ─── 4. Forgot Password & Reset Password ─────────────────────────

  async forgotPassword(email: string): Promise<{ message: string }> {
    const SAFE_RESPONSE = {
      message: 'If an account with that email exists, a 6-digit password reset code has been sent.',
    };

    const user = await this.repo.findByEmail(email.toLowerCase().trim());
    if (!user || !user.isActive || user.authProvider === 'GOOGLE') return SAFE_RESPONSE;

    const resetExpiresMin = this.config.get<number>('auth.passwordResetExpiresMinutes') ?? 15;
    const resetCode = generateOtpCode();
    const expiresAt = new Date(Date.now() + resetExpiresMin * 60_000);

    await this.repo.invalidatePendingResets(user.id);
    await this.repo.createPasswordReset(user.id, resetCode, expiresAt);

    // Fire-and-forget — HTTP response is NOT blocked by email delivery
    this.eventBus.publish(
      new PasswordResetRequestedEvent(user.id, user.email, resetCode, expiresAt, user.name),
    );

    return SAFE_RESPONSE;
  }

  async verifyResetCode(email: string, code: string): Promise<{ valid: boolean; message: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.repo.findByEmailWithTokens(normalizedEmail);

    if (!user || !user.isActive || user.authProvider === 'GOOGLE') {
      throw new BadRequestException('Invalid reset code or email.');
    }

    if (
      !user.passwordResetToken ||
      !user.passwordResetExpires ||
      user.passwordResetExpires.getTime() < Date.now()
    ) {
      throw new BadRequestException('Password reset code has expired. Please request a new code.');
    }

    if (!safeCodeEqual(code.trim(), user.passwordResetToken)) {
      throw new BadRequestException('Invalid password reset code. Please check and try again.');
    }

    return { valid: true, message: 'Reset code verified.' };
  }

  async resetPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.repo.findByEmailWithTokens(normalizedEmail);

    if (!user || !user.isActive || user.authProvider === 'GOOGLE') {
      throw new BadRequestException('Invalid reset code or email.');
    }

    if (
      !user.passwordResetToken ||
      !user.passwordResetExpires ||
      user.passwordResetExpires.getTime() < Date.now()
    ) {
      throw new BadRequestException('Password reset code has expired. Please request a new code.');
    }

    if (!safeCodeEqual(code.trim(), user.passwordResetToken)) {
      throw new BadRequestException('Invalid password reset code. Please check and try again.');
    }

    const passwordHash = await bcrypt.hash(
      newPassword,
      this.config.get<number>('auth.bcryptRounds') ?? 12,
    );

    await this.repo.updatePasswordAndClearReset(user.id, passwordHash);
    this.logger.log(`Password reset completed: ${user.email}`);

    return {
      message: 'Password has been reset successfully. You can now sign in with your new password.',
    };
  }

  // ─── 5. Refresh Token ────────────────────────────────────────────

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.repo.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account not found or deactivated');
    }

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      { secret: this.config.get<string>('jwt.secret'), expiresIn: '7d' },
    );
    return { accessToken };
  }
}

// ─── Module-level helpers ────────────────────────────────────────────────────

function safeCodeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

function toUserDto(user: {
  id: string;
  email: string;
  name: string | null;
  role: string;
  avatarUrl?: string | null;
  emailVerified?: boolean;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl ?? null,
    emailVerified: user.emailVerified ?? false,
  };
}
