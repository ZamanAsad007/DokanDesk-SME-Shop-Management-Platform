import { z } from 'zod';
import { Role } from '@dokandesk/shared';

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email('Valid email is required'),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(128),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  role: z.enum([Role.MANAGER, Role.CASHIER, Role.ACCOUNTANT, Role.STOREKEEPER]),
  phone: z.string().trim().max(32).optional(),
  branchIds: z.array(z.string().uuid()).optional(),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
