import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ApiErrorCode } from '@dokandesk/shared';

interface AttemptRecord {
  count: number;
  resetAt: number;
}

@Injectable()
export class LoginThrottlerService {
  private readonly attempts = new Map<string, AttemptRecord>();
  private readonly maxAttempts = 5;
  private readonly windowMs = 5 * 60 * 1000; // 5 minutes

  /**
   * Asserts that the key (e.g. IP + email) has not exceeded login rate limits.
   */
  assertNotThrottled(key: string): void {
    const record = this.attempts.get(key);
    const now = Date.now();

    if (record) {
      if (now > record.resetAt) {
        this.attempts.delete(key);
      } else if (record.count >= this.maxAttempts) {
        const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
        throw new HttpException(
          {
            code: ApiErrorCode.TOO_MANY_REQUESTS,
            message: `Too many failed login attempts. Please try again in ${retryAfterSeconds} seconds.`,
            details: { retryAfterSeconds },
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  recordFailedAttempt(key: string): void {
    const now = Date.now();
    const record = this.attempts.get(key);

    if (!record || now > record.resetAt) {
      this.attempts.set(key, { count: 1, resetAt: now + this.windowMs });
    } else {
      record.count += 1;
    }
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}
