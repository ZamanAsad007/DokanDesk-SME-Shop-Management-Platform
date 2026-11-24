import { z } from 'zod';
import { Role } from '@dokandesk/shared';

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(128).optional(),
  phone: z.string().trim().max(32).optional(),
  role: z
    .enum([Role.OWNER, Role.MANAGER, Role.CASHIER, Role.ACCOUNTANT, Role.STOREKEEPER])
    .optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  branchIds: z.array(z.string().uuid()).optional(),
});

export type UpdateUserDto = z.infer<typeof updateUserSchema>;
