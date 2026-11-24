import { AsyncLocalStorage } from 'node:async_hooks';
import { UnauthorizedException } from '@nestjs/common';
import { ApiErrorCode } from '@dokandesk/shared';

export interface TenantContextPayload {
  tenantId: string;
  userId?: string;
  branchId?: string;
  role?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<TenantContextPayload>();

/**
 * Runs a function within an isolated tenant context.
 */
export function runWithTenantContext<R>(context: TenantContextPayload, callback: () => R): R {
  return asyncLocalStorage.run(context, callback);
}

/**
 * Gets the current request's tenant context, if available.
 */
export function getTenantContext(): TenantContextPayload | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Gets the current tenant ID, if present.
 */
export function getTenantId(): string | undefined {
  return asyncLocalStorage.getStore()?.tenantId;
}

/**
 * Asserts that a tenant ID is present in the current execution context.
 * Throws UnauthorizedException if tenant context is missing.
 */
export function requireTenantId(): string {
  const tenantId = getTenantId();
  if (!tenantId) {
    throw new UnauthorizedException({
      code: ApiErrorCode.TENANT_NOT_FOUND,
      message: 'Active tenant context is required for this operation',
    });
  }
  return tenantId;
}
