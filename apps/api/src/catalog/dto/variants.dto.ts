import { z } from 'zod';

export const createVariantSchema = z.object({
  name: z.string().trim().min(1, 'Variant name is required').max(128),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'Variant SKU is required')
    .max(64)
    .regex(/^[A-Z0-9_-]+$/),
  barcode: z.string().trim().max(64).optional(),
  costPricePaisa: z.coerce.number().int().nonnegative().optional(),
  sellingPricePaisa: z.coerce.number().int().nonnegative().optional(),
  attributes: z.record(z.string()),
  isActive: z.boolean().default(true),
});

export type CreateVariantDto = z.infer<typeof createVariantSchema>;

export const updateVariantSchema = z.object({
  name: z.string().trim().min(1).max(128).optional(),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .min(1)
    .max(64)
    .regex(/^[A-Z0-9_-]+$/)
    .optional(),
  barcode: z.string().trim().max(64).nullable().optional(),
  costPricePaisa: z.coerce.number().int().nonnegative().nullable().optional(),
  sellingPricePaisa: z.coerce.number().int().nonnegative().nullable().optional(),
  attributes: z.record(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateVariantDto = z.infer<typeof updateVariantSchema>;
