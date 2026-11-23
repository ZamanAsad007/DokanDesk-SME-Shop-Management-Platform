import { z } from 'zod';

/**
 * Common Zod Schemas and Error Codes for DokanDesk
 */

export const ApiErrorCode = {
  // General & Auth
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',

  // Tenancy & Context
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  TENANT_SUSPENDED: 'TENANT_SUSPENDED',
  BRANCH_ACCESS_DENIED: 'BRANCH_ACCESS_DENIED',

  // Business Logic
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  NEGATIVE_STOCK_NOT_ALLOWED: 'NEGATIVE_STOCK_NOT_ALLOWED',
  CREDIT_LIMIT_EXCEEDED: 'CREDIT_LIMIT_EXCEEDED',
  SHIFT_NOT_OPEN: 'SHIFT_NOT_OPEN',
  SHIFT_ALREADY_OPEN: 'SHIFT_ALREADY_OPEN',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  INVOICE_ALREADY_VOIDED: 'INVOICE_ALREADY_VOIDED',
  INVALID_PAYMENT_SUM: 'INVALID_PAYMENT_SUM',
} as const;

export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

/**
 * Standard cursor-based pagination query schema.
 */
export const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CursorPaginationInput = z.infer<typeof cursorPaginationSchema>;

/**
 * Standard offset-based pagination query schema.
 */
export const offsetPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type OffsetPaginationInput = z.infer<typeof offsetPaginationSchema>;

/**
 * Standard sort order schema.
 */
export const sortOrderSchema = z.enum(['asc', 'desc']).default('desc');
export type SortOrder = z.infer<typeof sortOrderSchema>;

/**
 * Standard error response structure:
 * { "success": false, "error": { "code": "...", "message": "...", "details": {} } }
 */
export const apiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;

/**
 * Standard success response structure:
 * { "success": true, "data": T, "meta": { ... } }
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    cursor?: string | null;
    hasMore?: boolean;
    total?: number;
    page?: number;
    limit?: number;
  };
}
