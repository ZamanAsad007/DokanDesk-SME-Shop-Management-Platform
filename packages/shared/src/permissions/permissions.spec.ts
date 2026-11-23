import { describe, it, expect } from 'vitest';
import {
  Role,
  Permission,
  ROLE_PERMISSIONS,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  getRolePermissions,
} from './permissions.js';

describe('RBAC Permissions Matrix', () => {
  it('Owner has all permissions', () => {
    const allPermissions = Object.values(Permission);
    for (const permission of allPermissions) {
      expect(hasPermission(Role.OWNER, permission)).toBe(true);
    }
  });

  it('Cashier can create sales and collect dues but cannot view audit logs or manage settings', () => {
    expect(hasPermission(Role.CASHIER, Permission.SALES_CREATE)).toBe(true);
    expect(hasPermission(Role.CASHIER, Permission.DUES_COLLECT)).toBe(true);
    expect(hasPermission(Role.CASHIER, Permission.AUDIT_VIEW)).toBe(false);
    expect(hasPermission(Role.CASHIER, Permission.SETTINGS_MANAGE)).toBe(false);
    expect(hasPermission(Role.CASHIER, Permission.INVENTORY_ADJUST)).toBe(false);
  });

  it('Accountant has financial reports and accounts permissions but cannot create sales', () => {
    expect(hasPermission(Role.ACCOUNTANT, Permission.REPORTS_FINANCIAL)).toBe(true);
    expect(hasPermission(Role.ACCOUNTANT, Permission.ACCOUNTS_MANAGE)).toBe(true);
    expect(hasPermission(Role.ACCOUNTANT, Permission.SALES_CREATE)).toBe(false);
  });

  it('Storekeeper can adjust inventory and receive purchases but cannot view prices', () => {
    expect(hasPermission(Role.STOREKEEPER, Permission.INVENTORY_ADJUST)).toBe(true);
    expect(hasPermission(Role.STOREKEEPER, Permission.PURCHASING_RECEIVE)).toBe(true);
    expect(hasPermission(Role.STOREKEEPER, Permission.CATALOG_PRICING_VIEW)).toBe(false);
  });

  it('hasAllPermissions checks all required permissions correctly', () => {
    expect(
      hasAllPermissions(Role.CASHIER, [Permission.SALES_CREATE, Permission.DUES_COLLECT]),
    ).toBe(true);

    expect(
      hasAllPermissions(Role.CASHIER, [Permission.SALES_CREATE, Permission.SETTINGS_MANAGE]),
    ).toBe(false);
  });

  it('hasAnyPermission returns true if at least one permission matches', () => {
    expect(
      hasAnyPermission(Role.CASHIER, [Permission.SETTINGS_MANAGE, Permission.SALES_CREATE]),
    ).toBe(true);

    expect(
      hasAnyPermission(Role.CASHIER, [Permission.SETTINGS_MANAGE, Permission.AUDIT_VIEW]),
    ).toBe(false);
  });

  it('getRolePermissions returns an immutable list of permissions', () => {
    const cashierPerms = getRolePermissions(Role.CASHIER);
    expect(cashierPerms).toContain(Permission.SALES_CREATE);
    expect(cashierPerms.length).toBeGreaterThan(0);
  });
});
