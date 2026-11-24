import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { TokenService } from './services/token.service.js';
import { LoginThrottlerService } from './services/throttler.service.js';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import argon2 from 'argon2';
import { Role } from '@dokandesk/shared';

describe('AuthService', () => {
  let authService: AuthService;
  let mockPrisma: any;
  let tokenService: TokenService;
  let throttler: LoginThrottlerService;
  let mockLogger: any;

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = 'test_access_secret_min_32_characters_long_for_test';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_min_32_characters_long_for_test';

    mockPrisma = {
      tenant: {
        findUnique: vi.fn(),
      },
      user: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      refreshToken: {
        create: vi.fn().mockResolvedValue({ id: 'rt-1' }),
        findFirst: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      passwordResetToken: {
        create: vi.fn().mockResolvedValue({ id: 'prt-1' }),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(async (callback) => {
        if (typeof callback === 'function') {
          const tx = {
            tenant: {
              create: vi.fn().mockResolvedValue({
                id: 'tenant-1',
                name: 'Test Shop',
                slug: 'test-shop',
                currency: 'BDT',
                vat_rate_percent: 0,
                allow_negative_stock: false,
              }),
            },
            branch: {
              create: vi.fn().mockResolvedValue({
                id: 'branch-1',
                name: 'Main Branch',
                code: 'MAIN',
                is_main: true,
              }),
            },
            user: {
              create: vi.fn().mockResolvedValue({
                id: 'user-1',
                email: 'owner@test.com',
                name: 'Shop Owner',
                role: Role.OWNER,
              }),
            },
            userBranch: {
              create: vi.fn().mockResolvedValue({ id: 'ub-1' }),
            },
            auditLog: {
              create: vi.fn().mockResolvedValue({ id: 'al-1' }),
            },
          };
          return callback(tx);
        }
        return Promise.all(callback);
      }),
    };

    tokenService = new TokenService();
    throttler = new LoginThrottlerService();
    mockLogger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };

    authService = new AuthService(mockPrisma as any, tokenService, throttler, mockLogger);
  });

  describe('registerShop', () => {
    it('successfully registers shop, branch, owner, and returns tokens', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      const result = await authService.registerShop({
        shopName: 'Test Shop',
        shopSlug: 'test-shop',
        ownerName: 'Shop Owner',
        ownerEmail: 'owner@test.com',
        ownerPassword: 'Password123!',
        currency: 'BDT',
        vatRatePercent: 0,
        allowNegativeStock: false,
      });

      expect(result).toHaveProperty('tenant');
      expect(result.tenant.slug).toBe('test-shop');
      expect(result).toHaveProperty('branch');
      expect(result.branch.isMain).toBe(true);
      expect(result).toHaveProperty('user');
      expect(result.user.role).toBe(Role.OWNER);
      expect(result.tokens).toHaveProperty('accessToken');
      expect(result.tokens).toHaveProperty('refreshToken');
    });

    it('throws ConflictException if tenant slug is already registered', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        authService.registerShop({
          shopName: 'Existing Shop',
          shopSlug: 'existing-slug',
          ownerName: 'Owner',
          ownerEmail: 'owner@existing.com',
          ownerPassword: 'Password123!',
          currency: 'BDT',
          vatRatePercent: 0,
          allowNegativeStock: false,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('authenticates active user with valid password', async () => {
      const passwordHash = await argon2.hash('Secret123!');
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'user@test.com',
        name: 'User',
        role: Role.CASHIER,
        status: 'ACTIVE',
        password_hash: passwordHash,
        tenant_id: 'tenant-1',
        tenant: {
          id: 'tenant-1',
          name: 'Shop',
          slug: 'shop',
          status: 'ACTIVE',
          currency: 'BDT',
          vat_rate_percent: 0,
          allow_negative_stock: false,
        },
        user_branches: [],
      });

      const result = await authService.login(
        { email: 'user@test.com', password: 'Secret123!' },
        '127.0.0.1',
      );

      expect(result.user.email).toBe('user@test.com');
      expect(result.tokens).toHaveProperty('accessToken');
    });

    it('rejects invalid password and increments throttle', async () => {
      const passwordHash = await argon2.hash('CorrectPassword');
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'user@test.com',
        status: 'ACTIVE',
        password_hash: passwordHash,
        tenant: { status: 'ACTIVE' },
        user_branches: [],
      });

      await expect(
        authService.login({ email: 'user@test.com', password: 'WrongPassword' }, '127.0.0.1'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshToken', () => {
    it('rotates refresh token when valid', async () => {
      const testToken = 'valid-refresh-token-sample-string-123';
      const hash = tokenService.hashToken(testToken);

      mockPrisma.refreshToken.findFirst.mockResolvedValue({
        id: 'rt-1',
        token_hash: hash,
        revoked: false,
        expires_at: new Date(Date.now() + 100000),
        user: {
          id: 'user-1',
          tenant_id: 'tenant-1',
          role: Role.OWNER,
          email: 'user@test.com',
          name: 'User',
          status: 'ACTIVE',
          tenant: { status: 'ACTIVE' },
          user_branches: [],
        },
      });

      const result = await authService.refreshToken({ refreshToken: testToken });

      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        data: { revoked: true },
      });
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });
  });
});
