import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
  tenantSlug: z.string().trim().optional(),
});

export type LoginDto = z.infer<typeof loginSchema>;
