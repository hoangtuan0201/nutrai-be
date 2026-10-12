import {
  Injectable,
  Logger,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EventBus } from '@nestjs/cqrs';
import * as bcrypt from 'bcrypt';
import { FirebaseAuthService } from '../firebase/firebase-auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PasswordResetRequestedEvent } from './events/password-reset-requested.event';
import { AuthRepository } from './auth.repository';
import {
  JwtPayload,
  issueTokens,
  generateSecureToken,
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
    const tokens = await issueTokens(this.jwtService, this.config, user.id, user.email, user.role);

    this.logger.log(`New registration: ${user.email}`);
    return { tokens, isNewUser: true, user: toUserDto(user) };
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

  // ─── 4. Forgot Password ──────────────────────────────────────────

  async forgotPassword(email: string): Promise<{ message: string }> {
    const SAFE_RESPONSE = {
      message: 'If an account with that email exists, you will receive a password reset link shortly.',
    };

    const user = await this.repo.findByEmail(email.toLowerCase().trim());
    if (!user || !user.isActive || user.authProvider === 'GOOGLE') return SAFE_RESPONSE;

    const resetExpiresMin = this.config.get<number>('auth.passwordResetExpiresMinutes') ?? 30;
    const resetToken = generateSecureToken();
    const expiresAt = new Date(Date.now() + resetExpiresMin * 60_000);

    await this.repo.invalidatePendingResets(user.id);
    await this.repo.createPasswordReset(user.id, resetToken, expiresAt);

    // Fire-and-forget — HTTP response is NOT blocked by email delivery
    this.eventBus.publish(new PasswordResetRequestedEvent(user.id, user.email, resetToken, expiresAt));

    return SAFE_RESPONSE;
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

// ─── Module-level helper ─────────────────────────────────────────────────────

function toUserDto(user: { id: string; email: string; name: string | null; role: string }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
