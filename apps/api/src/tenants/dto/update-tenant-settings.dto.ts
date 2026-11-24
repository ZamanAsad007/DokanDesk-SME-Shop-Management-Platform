import { z } from 'zod';

export const updateTenantSettingsSchema = z.object({
  name: z.string().trim().min(2).max(128).optional(),
  currency: z.string().trim().max(8).optional(),
  vatRatePercent: z.coerce.number().min(0).max(100).optional(),
  allowNegativeStock: z.boolean().optional(),
});

export type UpdateTenantSettingsDto = z.infer<typeof updateTenantSettingsSchema>;
