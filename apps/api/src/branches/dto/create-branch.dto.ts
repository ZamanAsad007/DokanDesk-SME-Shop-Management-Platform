import { z } from 'zod';

export const createBranchSchema = z.object({
  name: z.string().trim().min(2, 'Branch name must be at least 2 characters').max(128),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'Branch code is required')
    .max(32)
    .regex(/^[A-Z0-9_-]+$/, 'Branch code must be alphanumeric with dashes/underscores'),
  isMain: z.boolean().default(false),
  address: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(32).optional(),
});

export type CreateBranchDto = z.infer<typeof createBranchSchema>;
