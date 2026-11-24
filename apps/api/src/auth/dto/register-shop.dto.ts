import { z } from 'zod';

export const registerShopSchema = z.object({
  shopName: z.string().trim().min(2, 'Shop name must be at least 2 characters').max(128),
  shopSlug: z
    .string()
    .trim()
    .min(2, 'Shop slug must be at least 2 characters')
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'Shop slug must be lowercase alphanumeric and dashes only'),
  currency: z.string().trim().max(8).default('BDT'),
  vatRatePercent: z.coerce.number().min(0).max(100).default(0),
  allowNegativeStock: z.boolean().default(false),
  ownerName: z.string().trim().min(2, 'Owner name must be at least 2 characters').max(128),
  ownerEmail: z.string().trim().toLowerCase().email('Valid owner email is required'),
  ownerPhone: z.string().trim().max(32).optional(),
  ownerPassword: z.string().min(8, 'Password must be at least 8 characters long'),
});

export type RegisterShopDto = z.infer<typeof registerShopSchema>;
