import { z } from 'zod';

export const stockLevelQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  lowStockOnly: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return undefined;
    }, z.boolean().optional())
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type StockLevelQueryInput = z.infer<typeof stockLevelQuerySchema>;

export const updateReorderPointSchema = z.object({
  reorderPoint: z.coerce.number().nonnegative('Reorder point cannot be negative'),
});

export type UpdateReorderPointDto = z.infer<typeof updateReorderPointSchema>;
