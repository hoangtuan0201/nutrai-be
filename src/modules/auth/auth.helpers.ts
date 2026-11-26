import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;   // internal user UUID
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokenResult {
  accessToken: string;
}

/**
 * Issues a stateless JWT access token.
 * Reads secret and expiry config from ConfigService.
 */
export async function issueTokens(
  jwtService: JwtService,
  config: ConfigService,
  userId: string,
  email: string,
  role: string,
): Promise<AuthTokenResult> {
  const payload = { sub: userId, email, role };
  const accessToken = await jwtService.signAsync(payload, {
    secret: config.get<string>('jwt.secret'),
    expiresIn: (config.get<string>('jwt.expiresIn') ?? '7d') as never,
  });
  return { accessToken };
}

/** Generates a cryptographically secure random hex token. */
export function generateSecureToken(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('crypto').randomBytes(32).toString('hex');
}

/** Generates a cryptographically secure 6-digit numeric OTP code (100000–999999). */
export function generateOtpCode(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return String(require('crypto').randomInt(100000, 1000000));
}

// Valid 60-char bcrypt hash (cost 12) so bcrypt.compare executes full key stretching
const DUMMY_HASH = '$2b$12$dummy.hash.to.prevent.timing.attacks.padding012345678';

/**
 * Returns the password hash to compare against — uses a dummy hash
 * if the user is not found to prevent timing-attack enumeration.
 */
export function safePasswordHash(hash: string | null | undefined): string {
  return hash ?? DUMMY_HASH;
}
