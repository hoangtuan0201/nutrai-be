import {
  Injectable,
  Inject,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { getAuth } from 'firebase-admin/auth';
import type { App } from 'firebase-admin/app';

export interface FirebaseDecodedToken {
  uid: string;
  email: string;
  name?: string;
  picture?: string;
  email_verified: boolean;
  firebase: {
    sign_in_provider: string;
  };
}

/**
 * FirebaseAuthService — verifies Firebase ID Tokens sent by the mobile client.
 *
 * Security principle:
 *   - We ONLY trust what Firebase Admin SDK cryptographically verifies.
 *   - We never trust email or uid passed directly from the client body.
 *   - The token must come from the Authorization header as a Bearer token.
 */
@Injectable()
export class FirebaseAuthService {
  private readonly logger = new Logger(FirebaseAuthService.name);

  constructor(
    @Inject('FIREBASE_ADMIN')
    private readonly firebaseApp: App,
  ) {}

  /**
   * Verify a Firebase ID Token and return the decoded claims.
   * Throws UnauthorizedException if the token is invalid, expired, or revoked.
   */
  async verifyIdToken(idToken: string): Promise<FirebaseDecodedToken> {
    try {
      const auth = getAuth(this.firebaseApp);
      const decoded = await auth.verifyIdToken(idToken, true); // true = check revocation

      if (!decoded.email) {
        throw new UnauthorizedException(
          'Google account does not have a verified email',
        );
      }

      if (!decoded.email_verified) {
        throw new UnauthorizedException('Google account email is not verified');
      }

      return decoded as unknown as FirebaseDecodedToken;
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) throw error;

      const message =
        error instanceof Error ? error.message : 'Unknown Firebase error';
      this.logger.warn(`Firebase token verification failed: ${message}`);
      throw new UnauthorizedException('Invalid or expired Firebase ID token');
    }
  }
}
