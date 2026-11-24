import { describe, it, expect } from 'vitest';
import { validateEnv } from './env.js';

describe('Environment Configuration Validation (Fail-Fast)', () => {
  const validEnv = {
    NODE_ENV: 'test',
    PORT: '3000',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/dokandesk_test?schema=public',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_SECRET: 'test_access_secret_must_be_at_least_32_characters_long',
    JWT_REFRESH_SECRET: 'test_refresh_secret_must_be_at_least_32_characters_long',
    WEB_ORIGIN: 'http://localhost:5173',
  };

  it('successfully validates complete and secure environment variables', () => {
    const parsed = validateEnv(validEnv);
    expect(parsed.NODE_ENV).toBe('test');
    expect(parsed.PORT).toBe(3000);
    expect(parsed.DATABASE_URL).toBe(validEnv.DATABASE_URL);
    expect(parsed.JWT_ACCESS_EXPIRES_IN).toBe('15m');
    expect(parsed.LOG_LEVEL).toBe('info');
  });

  it('fails fast when DATABASE_URL is missing or invalid', () => {
    const invalidEnv = { ...validEnv, DATABASE_URL: 'not-a-url' };
    expect(() => validateEnv(invalidEnv)).toThrow(/DATABASE_URL must be a valid PostgreSQL/);
  });

  it('fails fast when JWT_ACCESS_SECRET is shorter than 32 characters', () => {
    const invalidEnv = { ...validEnv, JWT_ACCESS_SECRET: 'too-short' };
    expect(() => validateEnv(invalidEnv)).toThrow(
      /JWT_ACCESS_SECRET must be at least 32 characters/,
    );
  });

  it('fails fast when WEB_ORIGIN is missing or invalid', () => {
    const invalidEnv = { ...validEnv, WEB_ORIGIN: 'invalid-origin' };
    expect(() => validateEnv(invalidEnv)).toThrow(/WEB_ORIGIN must be a valid URL/);
  });

  it('applies defaults for optional variables', () => {
    const minimalEnv = {
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/dokandesk?schema=public',
      REDIS_URL: 'redis://localhost:6379',
      JWT_ACCESS_SECRET: 'super_secret_access_token_with_more_than_32_chars_now',
      JWT_REFRESH_SECRET: 'super_secret_refresh_token_with_more_than_32_chars_now',
      WEB_ORIGIN: 'http://localhost:3000',
    };
    const parsed = validateEnv(minimalEnv);
    expect(parsed.PORT).toBe(3000);
    expect(parsed.NODE_ENV).toBe('development');
    expect(parsed.LOG_LEVEL).toBe('info');
  });
});
