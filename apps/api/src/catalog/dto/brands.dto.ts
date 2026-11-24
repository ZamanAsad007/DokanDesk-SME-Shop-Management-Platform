import { z } from 'zod';

export const createBrandSchema = z.object({
  name: z.string().trim().min(1, 'Brand name is required').max(128),
  description: z.string().trim().max(500).optional(),
});

export type CreateBrandDto = z.infer<typeof createBrandSchema>;

export const updateBrandSchema = z.object({
  name: z.string().trim().min(1).max(128).optional(),
  description: z.string().trim().max(500).nullable().optional(),
});

export type UpdateBrandDto = z.infer<typeof updateBrandSchema>;
