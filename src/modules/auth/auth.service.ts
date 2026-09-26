import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma/prisma.service';
import { FirebaseAuthService, FirebaseDecodedToken } from '../firebase/firebase-auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';

export interface JwtPayload {
  sub: string;    // user.id (our internal UUID — not Firebase UID)
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * AuthService — orchestrates:
 *   1. Firebase ID Token verification (via FirebaseAuthService)
 *   2. User upsert in PostgreSQL (via PrismaService)
 *   3. Internal JWT issuance (via JwtService)
 *
 * The mobile app MUST use the internal JWT for all subsequent API calls.
 * Firebase tokens are only used as the initial authentication proof.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly firebaseAuth: FirebaseAuthService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Exchange a Firebase ID Token for internal JWT tokens.
   * Creates a new user record if this is the first sign-in.
   */
  async loginWithGoogle(idToken: string): Promise<AuthResponseDto> {
    // 1. Verify token with Firebase Admin (cryptographic verification + revocation check)
    const decoded: FirebaseDecodedToken =
      await this.firebaseAuth.verifyIdToken(idToken);

    // 2. Upsert user in our database — we own the identity from here on
    const { user, isNewUser } = await this.upsertUser(decoded);

    // 3. Issue internal JWT tokens signed by our own secret
    const tokens = await this.issueTokens(user.id, user.email, user.role);

    this.logger.log(
      `Google login: ${user.email} (${isNewUser ? 'NEW' : 'EXISTING'})`,
    );

    return {
      tokens,
      isNewUser,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  /**
   * Refresh an access token using a valid refresh token.
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    const refreshSecret = this.config.get<string>('jwt.refreshSecret');

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new Error('Invalid or expired refresh token');
    }

    // Verify user still exists and is active
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new Error('User account not found or deactivated');
    }

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      {
        secret: this.config.get<string>('jwt.secret'),
        expiresIn: (this.config.get<string>('jwt.expiresIn') ?? '7d') as Parameters<typeof this.jwtService.signAsync>[1] extends { expiresIn?: infer E } ? E : never,
      },
    );

    return { accessToken };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async upsertUser(decoded: FirebaseDecodedToken) {
    const firebaseUid = decoded.uid;
    const email = decoded.email.toLowerCase().trim();
    const name = decoded.name ?? null;
    const avatarUrl = decoded.picture ?? null;

    let isNewUser = false;

    // Find by Firebase UID first, then fall back to email for existing accounts
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { firebaseUid },
          { email },
        ],
      },
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
          emailVerified: true, // Google guarantees email_verified
        },
      });
    } else {
      // Update Firebase UID and profile info if changed
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

    const payload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: jwtSecret,
        expiresIn: '7d',
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: '30d',
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
