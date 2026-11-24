import { z } from 'zod';

export const refreshTokenSchema = z.object({
  refreshToken: z.string().trim().min(10, 'Refresh token is required'),
});

export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;
