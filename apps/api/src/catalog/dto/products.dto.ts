import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().trim().min(2, 'Product name must be at least 2 characters').max(191),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'SKU is required')
    .max(64)
    .regex(/^[A-Z0-9_-]+$/, 'SKU must be uppercase alphanumeric with dashes/underscores'),
  barcode: z.string().trim().max(64).optional(),
  description: z.string().trim().max(1000).optional(),
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  unitId: z.string().uuid('Valid unitId is required'),
  costPricePaisa: z.coerce
    .number()
    .int('Cost price must be integer paisa')
    .nonnegative('Cost price cannot be negative'),
  sellingPricePaisa: z.coerce
    .number()
    .int('Selling price must be integer paisa')
    .nonnegative('Selling price cannot be negative'),
  mrpPaisa: z.coerce.number().int().nonnegative().optional(),
  vatRatePercent: z.coerce.number().min(0).max(100).default(0),
  reorderLevel: z.coerce.number().nonnegative().default(0),
  imageUrl: z.string().trim().max(512).optional(),
  isActive: z.boolean().default(true),
});

export type CreateProductDto = z.infer<typeof createProductSchema>;

export const updateProductSchema = z.object({
  name: z.string().trim().min(2).max(191).optional(),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .min(1)
    .max(64)
    .regex(/^[A-Z0-9_-]+$/)
    .optional(),
  barcode: z.string().trim().max(64).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  brandId: z.string().uuid().nullable().optional(),
  unitId: z.string().uuid().optional(),
  costPricePaisa: z.coerce.number().int().nonnegative().optional(),
  sellingPricePaisa: z.coerce.number().int().nonnegative().optional(),
  mrpPaisa: z.coerce.number().int().nonnegative().nullable().optional(),
  vatRatePercent: z.coerce.number().min(0).max(100).optional(),
  reorderLevel: z.coerce.number().nonnegative().optional(),
  imageUrl: z.string().trim().max(512).nullable().optional(),
  isActive: z.boolean().optional(),
  priceChangeReason: z.string().trim().max(255).optional(),
});

export type UpdateProductDto = z.infer<typeof updateProductSchema>;

export const productQuerySchema = z.object({
  search: z.string().trim().optional(),
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ProductQueryInput = z.infer<typeof productQuerySchema>;
