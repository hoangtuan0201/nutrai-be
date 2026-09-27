import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10),
  passwordResetExpiresMinutes: parseInt(process.env.PASSWORD_RESET_EXPIRES_MINUTES ?? '30', 10),
  appBaseUrl: process.env.APP_BASE_URL ?? 'https://app.nutraai.com',
  appResetPasswordPath: process.env.APP_RESET_PASSWORD_PATH ?? '/reset-password',
}));
