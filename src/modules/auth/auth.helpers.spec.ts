import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  issueTokens,
  generateSecureToken,
  safePasswordHash,
} from './auth.helpers';

describe('AuthHelpers', () => {
  describe('generateSecureToken', () => {
    it('should generate a 64-character hex string', () => {
      const token = generateSecureToken();
      expect(typeof token).toBe('string');
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should generate unique tokens on consecutive calls', () => {
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('safePasswordHash', () => {
    it('should return given hash if present', () => {
      const hash = '$2b$12$someValidBcryptHash';
      expect(safePasswordHash(hash)).toBe(hash);
    });

    it('should return dummy hash if null or undefined', () => {
      const dummy = safePasswordHash(null);
      expect(dummy).toContain('$2b$12$dummy');
      expect(safePasswordHash(undefined)).toBe(dummy);
    });
  });

  describe('issueTokens', () => {
    it('should sign access and refresh tokens with correct payload', async () => {
      const mockJwtService = {
        signAsync: jest.fn().mockImplementation((payload, options) => {
          return Promise.resolve(`token_for_${options.secret}`);
        }),
      } as unknown as JwtService;

      const mockConfigService = {
        get: jest.fn().mockImplementation((key: string) => {
          if (key === 'jwt.secret') return 'jwt-secret';
          if (key === 'jwt.refreshSecret') return 'refresh-secret';
          if (key === 'jwt.expiresIn') return '7d';
          if (key === 'jwt.refreshExpiresIn') return '30d';
          return null;
        }),
      } as unknown as ConfigService;

      const tokens = await issueTokens(
        mockJwtService,
        mockConfigService,
        'user-uuid-123',
        'test@nutraai.com',
        'USER',
      );

      expect(tokens).toEqual({
        accessToken: 'token_for_jwt-secret',
        refreshToken: 'token_for_refresh-secret',
      });
      expect(mockJwtService.signAsync).toHaveBeenCalledTimes(2);
    });
  });
});
