import { Injectable, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { ApiErrorCode } from '@dokandesk/shared';

export interface AuthTokenPayload {
  sub: string;
  tenantId: string;
  role: string;
  email: string;
  name: string;
  branchId?: string;
}

@Injectable()
export class TokenService {
  private get accessSecret(): string {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET is not configured');
    }
    return secret;
  }

  private get refreshSecret(): string {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is not configured');
    }
    return secret;
  }

  private get accessExpiresIn(): string {
    return process.env.JWT_ACCESS_EXPIRES_IN || '15m';
  }

  signAccessToken(payload: AuthTokenPayload): string {
    return jwt.sign(payload, this.accessSecret, {
      expiresIn: this.accessExpiresIn as any,
    });
  }

  verifyAccessToken(token: string): AuthTokenPayload {
    try {
      return jwt.verify(token, this.accessSecret) as AuthTokenPayload;
    } catch {
      throw new UnauthorizedException({
        code: ApiErrorCode.UNAUTHORIZED,
        message: 'Invalid or expired access token',
      });
    }
  }

  generateRefreshToken(): { rawToken: string; tokenHash: string; expiresAt: Date } {
    const rawToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    // Default 7 days expiry
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    return { rawToken, tokenHash, expiresAt };
  }

  generatePasswordResetToken(): { rawToken: string; tokenHash: string; expiresAt: Date } {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    // 1 hour expiry
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    return { rawToken, tokenHash, expiresAt };
  }

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
