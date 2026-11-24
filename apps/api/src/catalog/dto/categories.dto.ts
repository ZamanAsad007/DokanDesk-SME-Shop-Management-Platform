import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(128),
  parentId: z.string().uuid().optional(),
  description: z.string().trim().max(500).optional(),
});

export type CreateCategoryDto = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(128).optional(),
  parentId: z.string().uuid().nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
});

export type UpdateCategoryDto = z.infer<typeof updateCategorySchema>;
