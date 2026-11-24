import { z } from 'zod';

export const updateBranchSchema = z.object({
  name: z.string().trim().min(2).max(128).optional(),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1)
    .max(32)
    .regex(/^[A-Z0-9_-]+$/)
    .optional(),
  address: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(32).optional(),
});

export type UpdateBranchDto = z.infer<typeof updateBranchSchema>;
