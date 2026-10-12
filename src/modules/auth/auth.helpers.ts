import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;   // internal user UUID
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Issues a JWT access + refresh token pair.
 * Reads secrets and expiry config from ConfigService.
 */
export async function issueTokens(
  jwtService: JwtService,
  config: ConfigService,
  userId: string,
  email: string,
  role: string,
): Promise<TokenPair> {
  const payload = { sub: userId, email, role };
  const [accessToken, refreshToken] = await Promise.all([
    jwtService.signAsync(payload, {
      secret: config.get<string>('jwt.secret'),
      expiresIn: (config.get<string>('jwt.expiresIn') ?? '7d') as never,
    }),
    jwtService.signAsync(payload, {
      secret: config.get<string>('jwt.refreshSecret'),
      expiresIn: (config.get<string>('jwt.refreshExpiresIn') ?? '30d') as never,
    }),
  ]);
  return { accessToken, refreshToken };
}

/** Generates a cryptographically secure random hex token. */
export function generateSecureToken(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('crypto').randomBytes(32).toString('hex');
}

const DUMMY_HASH = '$2b$12$dummy.hash.to.prevent.timing.attacks.padding';

/**
 * Returns the password hash to compare against — uses a dummy hash
 * if the user is not found to prevent timing-attack enumeration.
 */
export function safePasswordHash(hash: string | null | undefined): string {
  return hash ?? DUMMY_HASH;
}
