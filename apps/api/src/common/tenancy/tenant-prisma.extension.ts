import { Prisma } from '@prisma/client';
import { getTenantId } from './tenant-context.js';

export const TENANT_SCOPED_MODELS: readonly Prisma.ModelName[] = [
  'Branch',
  'User',
  'AuditLog',
  'UserBranch',
  'RefreshToken',
  'PasswordResetToken',
  'Category',
  'Brand',
  'Unit',
  'UnitConversion',
  'Product',
  'ProductVariant',
  'PriceHistory',
  'StockMovement',
  'StockLevel',
  'StockAdjustment',
  'StockTransfer',
  'StockTransferItem',
] as const;

/**
 * Prisma Client Extension that automatically injects tenant_id filters
 * and sets tenant_id on entity creation.
 */
export function createTenantIsolationExtension() {
  return Prisma.defineExtension((client) => {
    return client.$extends({
      name: 'tenantIsolation',
      query: {
        $allModels: {
          async findFirst({ model, args, query }) {
            const tenantId = getTenantId();
            if (tenantId && isTenantScoped(model)) {
              args.where = { ...(args.where as any), tenant_id: tenantId };
            }
            return query(args);
          },

          async findMany({ model, args, query }) {
            const tenantId = getTenantId();
            if (tenantId && isTenantScoped(model)) {
              args.where = { ...(args.where as any), tenant_id: tenantId };
            }
            return query(args);
          },

          async count({ model, args, query }) {
            const tenantId = getTenantId();
            if (tenantId && isTenantScoped(model)) {
              args.where = { ...(args.where as any), tenant_id: tenantId };
            }
            return query(args);
          },

          async create({ model, args, query }) {
            const tenantId = getTenantId();
            if (tenantId && isTenantScoped(model)) {
              args.data = { ...(args.data as any), tenant_id: tenantId };
            }
            return query(args);
          },

          async update({ model, args, query }) {
            const tenantId = getTenantId();
            if (tenantId && isTenantScoped(model)) {
              args.where = { ...(args.where as any), tenant_id: tenantId };
            }
            return query(args);
          },

          async updateMany({ model, args, query }) {
            const tenantId = getTenantId();
            if (tenantId && isTenantScoped(model)) {
              args.where = { ...(args.where as any), tenant_id: tenantId };
            }
            return query(args);
          },

          async delete({ model, args, query }) {
            const tenantId = getTenantId();
            if (tenantId && isTenantScoped(model)) {
              args.where = { ...(args.where as any), tenant_id: tenantId };
            }
            return query(args);
          },

          async deleteMany({ model, args, query }) {
            const tenantId = getTenantId();
            if (tenantId && isTenantScoped(model)) {
              args.where = { ...(args.where as any), tenant_id: tenantId };
            }
            return query(args);
          },
        },
      },
    });
  });
}

function isTenantScoped(model: string): boolean {
  return (TENANT_SCOPED_MODELS as readonly string[]).includes(model);
}
