import { describe, it, expect } from 'vitest';
import pino from 'pino';
import { REDACTED_PATHS } from './logger.service.js';

describe('Logger Service Sensitive Data Redaction', () => {
  it('redacts sensitive fields like passwords, tokens, and PINs from log records', async () => {
    let capturedLog = '';
    const destination = {
      write(chunk: string) {
        capturedLog += chunk;
      },
    };

    const testLogger = pino(
      {
        level: 'info',
        redact: {
          paths: REDACTED_PATHS,
          censor: '[REDACTED]',
        },
      },
      destination,
    );

    testLogger.info({
      user: {
        id: 'u1',
        email: 'user@example.com',
        password: 'my-super-secret-password-123',
        pin: '1234',
      },
      token: 'jwt.token.string',
      headers: {
        authorization: 'Bearer secret_access_token',
      },
    }, 'User logged in');

    expect(capturedLog).not.toContain('my-super-secret-password-123');
    expect(capturedLog).not.toContain('1234');
    expect(capturedLog).not.toContain('jwt.token.string');
    expect(capturedLog).not.toContain('secret_access_token');
    expect(capturedLog).toContain('[REDACTED]');
  });
});
