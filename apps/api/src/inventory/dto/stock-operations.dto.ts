import { z } from 'zod';

export const recordOpeningStockSchema = z.object({
  branchId: z.string().uuid('Valid branchId is required'),
  productId: z.string().uuid('Valid productId is required'),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  unitCostPaisa: z.coerce
    .number()
    .int('Unit cost must be integer paisa')
    .nonnegative('Unit cost cannot be negative'),
  notes: z.string().trim().max(1000).optional(),
});

export type RecordOpeningStockDto = z.infer<typeof recordOpeningStockSchema>;

export const recordAdjustmentSchema = z.object({
  branchId: z.string().uuid('Valid branchId is required'),
  productId: z.string().uuid('Valid productId is required'),
  quantityDelta: z.coerce.number().refine((n) => n !== 0, 'Quantity delta cannot be 0'),
  reason: z.string().trim().min(2, 'Reason is required (min 2 chars)').max(128),
  notes: z.string().trim().max(1000).optional(),
});

export type RecordAdjustmentDto = z.infer<typeof recordAdjustmentSchema>;

export const recordDamageSchema = z.object({
  branchId: z.string().uuid('Valid branchId is required'),
  productId: z.string().uuid('Valid productId is required'),
  quantity: z.coerce.number().positive('Damage quantity must be greater than 0'),
  reason: z.string().trim().max(128).default('Damaged goods'),
  notes: z.string().trim().max(1000).optional(),
});

export type RecordDamageDto = z.infer<typeof recordDamageSchema>;

export const transferItemSchema = z.object({
  productId: z.string().uuid('Valid productId is required'),
  quantity: z.coerce.number().positive('Transfer quantity must be greater than 0'),
});

export const createTransferSchema = z
  .object({
    fromBranchId: z.string().uuid('Valid fromBranchId is required'),
    toBranchId: z.string().uuid('Valid toBranchId is required'),
    items: z.array(transferItemSchema).min(1, 'At least one item is required for transfer'),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((data) => data.fromBranchId !== data.toBranchId, {
    message: 'Source branch and destination branch must be different',
    path: ['toBranchId'],
  });

export type CreateTransferDto = z.infer<typeof createTransferSchema>;

export const transferQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  status: z.enum(['DISPATCHED', 'RECEIVED', 'CANCELLED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type TransferQueryInput = z.infer<typeof transferQuerySchema>;
