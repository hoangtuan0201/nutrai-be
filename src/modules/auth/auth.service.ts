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
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { FirebaseAuthService, FirebaseDecodedToken } from '../firebase/firebase-auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PasswordResetRequestedEvent } from './events/password-reset-requested.event';

export interface JwtPayload {
  sub: string;    // user.id (our internal UUID — not Firebase UID)
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}


/**
 * AuthService — orchestrates:
 *   1. Firebase ID Token verification  → Google Sign-In
 *   2. Email/Password register & login → classic auth
 *   3. Forgot-password token generation
 *   4. Internal JWT issuance
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly firebaseAuth: FirebaseAuthService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly eventBus: EventBus,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // 1. GOOGLE SIGN-IN (Firebase)
  // ═══════════════════════════════════════════════════════════════

  async loginWithGoogle(idToken: string): Promise<AuthResponseDto> {
    const decoded: FirebaseDecodedToken =
      await this.firebaseAuth.verifyIdToken(idToken);

    const { user, isNewUser } = await this.upsertGoogleUser(decoded);
    const tokens = await this.issueTokens(user.id, user.email, user.role);

    this.logger.log(`Google login: ${user.email} (${isNewUser ? 'NEW' : 'EXISTING'})`);

    return {
      tokens,
      isNewUser,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. EMAIL / PASSWORD — REGISTER
  // ═══════════════════════════════════════════════════════════════

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const email = dto.email.toLowerCase().trim();

    // Check duplicate email
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(
      dto.password,
      this.config.get<number>('auth.bcryptRounds') ?? 12,
    );

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name: dto.name ?? null,
        authProvider: 'EMAIL',
        role: 'USER',
        isActive: true,
        emailVerified: false, // Would be verified via email link in production
      },
    });

    const tokens = await this.issueTokens(user.id, user.email, user.role);

    this.logger.log(`New registration: ${user.email}`);

    return {
      tokens,
      isNewUser: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. EMAIL / PASSWORD — LOGIN
  // ═══════════════════════════════════════════════════════════════

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const email = dto.email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({ where: { email } });

    // Use constant-time comparison to prevent timing attacks:
    // Run bcrypt even if user not found (compare against a dummy hash)
    const DUMMY_HASH = '$2b$12$dummy.hash.to.prevent.timing.attacks.padding';
    const passwordHash = user?.passwordHash ?? DUMMY_HASH;
    const isPasswordValid = await bcrypt.compare(dto.password, passwordHash);

    if (!user || !isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Your account has been deactivated');
    }

    if (user.authProvider === 'GOOGLE' && !user.passwordHash) {
      throw new UnauthorizedException(
        'This account uses Google Sign-In. Please sign in with Google.',
      );
    }

    const tokens = await this.issueTokens(user.id, user.email, user.role);

    this.logger.log(`Login: ${user.email}`);

    return {
      tokens,
      isNewUser: false,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. FORGOT PASSWORD
  // ═══════════════════════════════════════════════════════════════

  /**
   * Initiates a password reset flow.
   *
   * Security note: Always return the same success response regardless of
   * whether the email exists — this prevents user enumeration attacks.
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Always respond the same way (anti-enumeration)
    const SAFE_RESPONSE = {
      message:
        'If an account with that email exists, you will receive a password reset link shortly.',
    };

    if (!user || !user.isActive) return SAFE_RESPONSE;

    // Only EMAIL provider accounts can reset password via this flow
    if (user.authProvider === 'GOOGLE') return SAFE_RESPONSE;

    // Invalidate any previous unused tokens for this user
    await this.prisma.passwordReset.updateMany({
      where: { userId: user.id, isUsed: false },
      data: { isUsed: true },
    });

    const resetExpiresMinutes =
      this.config.get<number>('auth.passwordResetExpiresMinutes') ?? 30;
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + resetExpiresMinutes * 60 * 1000);

    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        token: resetToken,
        expiresAt,
      },
    });

    // Fire-and-forget: publish event — HTTP response is NOT blocked by email sending
    this.eventBus.publish(
      new PasswordResetRequestedEvent(user.id, user.email, resetToken, expiresAt),
    );

    return SAFE_RESPONSE;
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. REFRESH TOKEN
  // ═══════════════════════════════════════════════════════════════

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    const refreshSecret = this.config.get<string>('jwt.refreshSecret');

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account not found or deactivated');
    }

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      { secret: this.config.get<string>('jwt.secret'), expiresIn: '7d' },
    );

    return { accessToken };
  }

  // ═══════════════════════════════════════════════════════════════
  // Private helpers
  // ═══════════════════════════════════════════════════════════════

  private async upsertGoogleUser(decoded: FirebaseDecodedToken) {
    const firebaseUid = decoded.uid;
    const email = decoded.email.toLowerCase().trim();
    const name = decoded.name ?? null;
    const avatarUrl = decoded.picture ?? null;

    let isNewUser = false;
    let user = await this.prisma.user.findFirst({
      where: { OR: [{ firebaseUid }, { email }] },
    });

    if (!user) {
      isNewUser = true;
      user = await this.prisma.user.create({
        data: {
          email,
          name,
          avatarUrl,
          firebaseUid,
          authProvider: 'GOOGLE',
          role: 'USER',
          isActive: true,
          emailVerified: true,
        },
      });
    } else {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          firebaseUid,
          emailVerified: true,
          ...(name && { name }),
          ...(avatarUrl && { avatarUrl }),
        },
      });
    }

    return { user, isNewUser };
  }

  private async issueTokens(userId: string, email: string, role: string) {
    const jwtSecret = this.config.get<string>('jwt.secret');
    const refreshSecret = this.config.get<string>('jwt.refreshSecret');
    const accessExpiresIn = this.config.get<string>('jwt.expiresIn') ?? '7d';
    const refreshExpiresIn = this.config.get<string>('jwt.refreshExpiresIn') ?? '30d';
    const payload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { secret: jwtSecret, expiresIn: accessExpiresIn as never }),
      this.jwtService.signAsync(payload, { secret: refreshSecret, expiresIn: refreshExpiresIn as never }),
    ]);

    return { accessToken, refreshToken };
  }
}
