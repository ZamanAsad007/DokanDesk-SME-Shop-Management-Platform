import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load .env file if present
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection URL'),
  REDIS_URL: z.string().url('REDIS_URL must be a valid Redis connection URL'),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters long for security'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters long for security'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  WEB_ORIGIN: z.string().url('WEB_ORIGIN must be a valid URL'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validates a dictionary of environment variables and throws on error.
 */
export function validateEnv(raw: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const errorMessages = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    console.error('FATAL: Environment configuration validation failed:\n' + errorMessages);
    throw new Error('Environment validation failed:\n' + errorMessages);
  }
  return result.data;
}

// In non-test environments, validate process.env immediately on import
export const env: EnvConfig =
  process.env.NODE_ENV === 'test' ? ({} as EnvConfig) : validateEnv(process.env);
