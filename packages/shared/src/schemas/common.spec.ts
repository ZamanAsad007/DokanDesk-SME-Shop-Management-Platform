import { describe, it, expect } from 'vitest';
import {
  cursorPaginationSchema,
  offsetPaginationSchema,
  apiErrorResponseSchema,
  ApiErrorCode,
} from './common.js';

describe('Common Zod Schemas', () => {
  describe('cursorPaginationSchema', () => {
    it('applies default limit when omitted', () => {
      const parsed = cursorPaginationSchema.parse({});
      expect(parsed.limit).toBe(20);
      expect(parsed.cursor).toBeUndefined();
    });

    it('coerces query string values into numbers', () => {
      const parsed = cursorPaginationSchema.parse({ limit: '50', cursor: 'prod_123' });
      expect(parsed.limit).toBe(50);
      expect(parsed.cursor).toBe('prod_123');
    });

    it('clamps limit to maximum 100', () => {
      expect(() => cursorPaginationSchema.parse({ limit: '200' })).toThrow();
    });
  });

  describe('offsetPaginationSchema', () => {
    it('parses valid page and limit', () => {
      const parsed = offsetPaginationSchema.parse({ page: '2', limit: '25' });
      expect(parsed.page).toBe(2);
      expect(parsed.limit).toBe(25);
    });

    it('applies default page and limit', () => {
      const parsed = offsetPaginationSchema.parse({});
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(20);
    });
  });

  describe('apiErrorResponseSchema', () => {
    it('validates a standard error response payload', () => {
      const errorPayload = {
        success: false,
        error: {
          code: ApiErrorCode.INSUFFICIENT_STOCK,
          message: 'Requested 5 units but only 2 available.',
          details: { productId: 'p1', available: 2 },
        },
      };

      const result = apiErrorResponseSchema.safeParse(errorPayload);
      expect(result.success).toBe(true);
    });

    it('rejects payloads where success is true', () => {
      const invalidPayload = {
        success: true,
        error: { code: 'ERROR', message: 'test' },
      };
      const result = apiErrorResponseSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });
});
