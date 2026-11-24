import { z } from 'zod';

export const createUnitSchema = z.object({
  name: z.string().trim().min(1, 'Unit name is required').max(64),
  code: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Unit code is required')
    .max(32)
    .regex(/^[a-z0-9_-]+$/, 'Unit code must be lowercase alphanumeric'),
});

export type CreateUnitDto = z.infer<typeof createUnitSchema>;

export const createUnitConversionSchema = z.object({
  fromUnitId: z.string().uuid('fromUnitId must be a valid UUID'),
  toUnitId: z.string().uuid('toUnitId must be a valid UUID'),
  multiplier: z.coerce.number().positive('Multiplier must be greater than 0'),
});

export type CreateUnitConversionDto = z.infer<typeof createUnitConversionSchema>;
