import { z } from 'zod';

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Valid email is required'),
  tenantSlug: z.string().trim().optional(),
});

export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(10, 'Reset token is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
});

export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
