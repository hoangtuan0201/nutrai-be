import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.coerce.number(),
  NODE_ENV: z.enum(['development', 'production', 'test']),
  POSTGRES_USER: z.string().min(1, 'POSTGRES_USER is required'),
  POSTGRES_PASSWORD: z.string().min(1, 'POSTGRES_PASSWORD is required'),
  POSTGRES_DB: z.string().min(1, 'POSTGRES_DB is required'),
  POSTGRES_HOST: z.string().min(1, 'POSTGRES_HOST is required'),
  POSTGRES_PORT: z.coerce.number(),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_HOST: z.string().min(1, 'REDIS_HOST is required'),
  REDIS_PORT: z.coerce.number(),
  REDIS_PASSWORD: z.string().optional(),

  // Firebase
  FIREBASE_PROJECT_ID: z.string().min(1, 'FIREBASE_PROJECT_ID is required'),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),

  // JWT (internal tokens)
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // Auth behaviour
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  PASSWORD_RESET_EXPIRES_MINUTES: z.coerce.number().int().positive().default(30),

  // App URLs
  APP_BASE_URL: z.string().url().default('https://app.nutraai.com'),
  APP_RESET_PASSWORD_PATH: z.string().default('/reset-password'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>) {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    console.error('❌ Environment validation failed:', result.error.format());
    throw new Error('Environment validation failed');
  }
  return result.data;
}
