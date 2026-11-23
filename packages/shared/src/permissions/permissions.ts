/**
 * RBAC Roles and Permissions for DokanDesk
 * Based on Section 4 of the DokanDesk System Specification.
 */

export const Role = {
  OWNER: 'OWNER',
  MANAGER: 'MANAGER',
  CASHIER: 'CASHIER',
  ACCOUNTANT: 'ACCOUNTANT',
  STOREKEEPER: 'STOREKEEPER',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const Permission = {
  // Settings & Shop Administration
  SETTINGS_MANAGE: 'settings.manage',
  SETTINGS_VIEW: 'settings.view',

  // User Management
  USERS_MANAGE: 'users.manage',
  USERS_VIEW: 'users.view',

  // Branches
  BRANCHES_MANAGE: 'branches.manage',
  BRANCHES_VIEW: 'branches.view',

  // Catalog (Products, Categories, Brands, Units)
  CATALOG_MANAGE: 'catalog.manage',
  CATALOG_VIEW: 'catalog.view',
  CATALOG_PRICING_VIEW: 'catalog.pricing.view',
  CATALOG_PRICING_MANAGE: 'catalog.pricing.manage',

  // Inventory (Stock, Adjustments, Transfers, Stocktake)
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_ADJUST: 'inventory.adjust',
  INVENTORY_TRANSFER: 'inventory.transfer',

  // Purchasing & Suppliers
  PURCHASING_MANAGE: 'purchasing.manage',
  PURCHASING_VIEW: 'purchasing.view',
  PURCHASING_RECEIVE: 'purchasing.receive',
  PURCHASING_PAY: 'purchasing.pay',

  // Sales & POS
  SALES_CREATE: 'sales.create',
  SALES_VIEW: 'sales.view',
  SALES_DISCOUNT_OVERRIDE: 'sales.discount_override',
  SALES_VOID: 'sales.void',
  SALES_RETURN: 'sales.return',
  SALES_SHIFT_MANAGE: 'sales.shift_manage',

  // Customers & Dues (Baki)
  CUSTOMERS_MANAGE: 'customers.manage',
  CUSTOMERS_VIEW: 'customers.view',
  DUES_COLLECT: 'dues.collect',

  // Expenses & Accounts
  ACCOUNTS_MANAGE: 'accounts.manage',
  ACCOUNTS_VIEW: 'accounts.view',
  EXPENSES_MANAGE: 'expenses.manage',
  EXPENSES_VIEW: 'expenses.view',

  // Reports
  REPORTS_ALL: 'reports.all',
  REPORTS_FINANCIAL: 'reports.financial',
  REPORTS_STOCK: 'reports.stock',
  REPORTS_OWN_SHIFT: 'reports.own_shift',

  // Audit Logs
  AUDIT_VIEW: 'audit.view',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

/**
 * Default permission assignments per role as defined in Section 4 of DokanDesk design.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [Role.OWNER]: Object.values(Permission),

  [Role.MANAGER]: [
    Permission.SETTINGS_VIEW,
    Permission.USERS_VIEW,
    Permission.BRANCHES_VIEW,
    Permission.CATALOG_MANAGE,
    Permission.CATALOG_VIEW,
    Permission.CATALOG_PRICING_VIEW,
    Permission.CATALOG_PRICING_MANAGE,
    Permission.INVENTORY_VIEW,
    Permission.INVENTORY_ADJUST,
    Permission.INVENTORY_TRANSFER,
    Permission.PURCHASING_MANAGE,
    Permission.PURCHASING_VIEW,
    Permission.PURCHASING_RECEIVE,
    Permission.PURCHASING_PAY,
    Permission.SALES_CREATE,
    Permission.SALES_VIEW,
    Permission.SALES_DISCOUNT_OVERRIDE,
    Permission.SALES_VOID,
    Permission.SALES_RETURN,
    Permission.SALES_SHIFT_MANAGE,
    Permission.CUSTOMERS_MANAGE,
    Permission.CUSTOMERS_VIEW,
    Permission.DUES_COLLECT,
    Permission.ACCOUNTS_MANAGE,
    Permission.ACCOUNTS_VIEW,
    Permission.EXPENSES_MANAGE,
    Permission.EXPENSES_VIEW,
    Permission.REPORTS_ALL,
    Permission.AUDIT_VIEW,
  ],

  [Role.CASHIER]: [
    Permission.CATALOG_VIEW,
    Permission.CATALOG_PRICING_VIEW,
    Permission.SALES_CREATE,
    Permission.SALES_VIEW,
    Permission.SALES_RETURN,
    Permission.SALES_SHIFT_MANAGE,
    Permission.CUSTOMERS_VIEW,
    Permission.CUSTOMERS_MANAGE,
    Permission.DUES_COLLECT,
    Permission.REPORTS_OWN_SHIFT,
  ],

  [Role.ACCOUNTANT]: [
    Permission.CATALOG_VIEW,
    Permission.CATALOG_PRICING_VIEW,
    Permission.INVENTORY_VIEW,
    Permission.PURCHASING_VIEW,
    Permission.PURCHASING_PAY,
    Permission.CUSTOMERS_VIEW,
    Permission.DUES_COLLECT,
    Permission.ACCOUNTS_MANAGE,
    Permission.ACCOUNTS_VIEW,
    Permission.EXPENSES_MANAGE,
    Permission.EXPENSES_VIEW,
    Permission.REPORTS_FINANCIAL,
    Permission.AUDIT_VIEW,
  ],

  [Role.STOREKEEPER]: [
    Permission.CATALOG_VIEW,
    Permission.CATALOG_MANAGE,
    Permission.INVENTORY_VIEW,
    Permission.INVENTORY_ADJUST,
    Permission.INVENTORY_TRANSFER,
    Permission.PURCHASING_VIEW,
    Permission.PURCHASING_RECEIVE,
    Permission.REPORTS_STOCK,
  ],
};

/**
 * Checks whether a given role has a specific permission.
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) {
    return false;
  }
  return permissions.includes(permission);
}

/**
 * Checks if a role has all of the required permissions.
 */
export function hasAllPermissions(role: Role, required: Permission[]): boolean {
  return required.every((p) => hasPermission(role, p));
}

/**
 * Checks if a role has at least one of the required permissions.
 */
export function hasAnyPermission(role: Role, required: Permission[]): boolean {
  return required.some((p) => hasPermission(role, p));
}

/**
 * Returns all permissions granted to a given role.
 */
export function getRolePermissions(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
