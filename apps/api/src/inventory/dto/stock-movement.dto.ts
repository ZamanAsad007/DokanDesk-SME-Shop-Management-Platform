import { z } from 'zod';
import { StockMovementType } from '@prisma/client';

export const createMovementSchema = z.object({
  branchId: z.string().uuid('Valid branchId is required'),
  productId: z.string().uuid('Valid productId is required'),
  type: z.nativeEnum(StockMovementType),
  quantity: z.coerce.number().refine((n) => n !== 0, 'Quantity cannot be 0'),
  unitCostPaisa: z.coerce.number().int().nonnegative().default(0),
  referenceType: z.string().trim().max(64).optional(),
  referenceId: z.string().trim().max(128).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export type CreateMovementDto = z.infer<typeof createMovementSchema>;

export const movementQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  type: z.nativeEnum(StockMovementType).optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type MovementQueryInput = z.infer<typeof movementQuerySchema>;
