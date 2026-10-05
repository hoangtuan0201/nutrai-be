import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS!, 10),
  passwordResetExpiresMinutes: parseInt(process.env.PASSWORD_RESET_EXPIRES_MINUTES!, 10),
  appBaseUrl: process.env.APP_BASE_URL!,
  appResetPasswordPath: process.env.APP_RESET_PASSWORD_PATH!,
}));
