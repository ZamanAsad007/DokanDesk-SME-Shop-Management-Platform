import { describe, it, expect } from 'vitest';
import {
  runWithTenantContext,
  getTenantContext,
  getTenantId,
  requireTenantId,
} from './tenant-context.js';
import { TenantGuard } from './tenant.guard.js';
import { UnauthorizedException } from '@nestjs/common';

describe('Tenant Context & Isolation', () => {
  it('stores and retrieves tenant context in current async scope', () => {
    runWithTenantContext(
      { tenantId: 'tenant-123', branchId: 'branch-1' },
      () => {
        expect(getTenantId()).toBe('tenant-123');
        expect(getTenantContext()?.branchId).toBe('branch-1');
      },
    );

    // Outside of the context, tenantId is undefined
    expect(getTenantId()).toBeUndefined();
  });

  it('guarantees tenant isolation across concurrent asynchronous operations', async () => {
    const taskA = new Promise<string | undefined>((resolve) => {
      runWithTenantContext({ tenantId: 'tenant-AAA' }, async () => {
        await new Promise((r) => setTimeout(r, 15));
        resolve(getTenantId());
      });
    });

    const taskB = new Promise<string | undefined>((resolve) => {
      runWithTenantContext({ tenantId: 'tenant-BBB' }, async () => {
        await new Promise((r) => setTimeout(r, 10));
        resolve(getTenantId());
      });
    });

    const [tenantA, tenantB] = await Promise.all([taskA, taskB]);
    expect(tenantA).toBe('tenant-AAA');
    expect(tenantB).toBe('tenant-BBB');
  });

  it('requireTenantId throws UnauthorizedException when context is not present', () => {
    expect(() => requireTenantId()).toThrow(UnauthorizedException);
  });

  it('TenantGuard enforces presence of tenant context', () => {
    const guard = new TenantGuard();
    const mockContext: any = {};

    expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);

    runWithTenantContext({ tenantId: 'valid-tenant' }, () => {
      expect(guard.canActivate(mockContext)).toBe(true);
    });
  });
});
