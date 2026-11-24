import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import argon2 from 'argon2';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { TokenService } from './services/token.service.js';
import { LoginThrottlerService } from './services/throttler.service.js';
import { RegisterShopDto } from './dto/register-shop.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto.js';
import { ApiErrorCode, getRolePermissions, Role } from '@dokandesk/shared';
import { AppLoggerService } from '../common/logger/logger.service.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TokenService) private readonly tokenService: TokenService,
    @Inject(LoginThrottlerService) private readonly throttler: LoginThrottlerService,
    @Inject(AppLoggerService) private readonly logger: AppLoggerService,
  ) {}

  /**
   * Registers a new tenant shop, its main branch, and owner user in a single atomic transaction.
   */
  async registerShop(dto: RegisterShopDto) {
    // Check if slug or owner email already exists
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.shopSlug },
    });
    if (existingTenant) {
      throw new ConflictException({
        code: ApiErrorCode.BAD_REQUEST,
        message: `Shop slug '${dto.shopSlug}' is already taken`,
      });
    }

    const passwordHash = await argon2.hash(dto.ownerPassword);

    // Atomic transaction for tenant + main branch + owner user + branch link
    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.shopName,
          slug: dto.shopSlug,
          currency: dto.currency,
          vat_rate_percent: dto.vatRatePercent,
          allow_negative_stock: dto.allowNegativeStock,
        },
      });

      const branch = await tx.branch.create({
        data: {
          tenant_id: tenant.id,
          name: 'Main Branch',
          code: 'MAIN',
          is_main: true,
          phone: dto.ownerPhone,
        },
      });

      const user = await tx.user.create({
        data: {
          tenant_id: tenant.id,
          email: dto.ownerEmail,
          name: dto.ownerName,
          phone: dto.ownerPhone,
          password_hash: passwordHash,
          role: Role.OWNER,
        },
      });

      await tx.userBranch.create({
        data: {
          tenant_id: tenant.id,
          user_id: user.id,
          branch_id: branch.id,
        },
      });

      // Create initial audit log
      await tx.auditLog.create({
        data: {
          tenant_id: tenant.id,
          user_id: user.id,
          action: 'REGISTER_SHOP',
          entity_type: 'Tenant',
          entity_id: tenant.id,
          new_values: {
            shopName: tenant.name,
            shopSlug: tenant.slug,
            ownerEmail: user.email,
          },
        },
      });

      return { tenant, branch, user };
    });

    const accessToken = this.tokenService.signAccessToken({
      sub: result.user.id,
      tenantId: result.tenant.id,
      role: result.user.role,
      email: result.user.email,
      name: result.user.name,
      branchId: result.branch.id,
    });

    const { rawToken, tokenHash, expiresAt } = this.tokenService.generateRefreshToken();
    await this.prisma.refreshToken.create({
      data: {
        tenant_id: result.tenant.id,
        user_id: result.user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });

    this.logger.log(`Shop '${result.tenant.name}' registered successfully`, 'AuthService');

    return {
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
        currency: result.tenant.currency,
        vatRatePercent: Number(result.tenant.vat_rate_percent),
        allowNegativeStock: result.tenant.allow_negative_stock,
      },
      branch: {
        id: result.branch.id,
        name: result.branch.name,
        code: result.branch.code,
        isMain: result.branch.is_main,
      },
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        permissions: getRolePermissions(result.user.role as Role),
      },
      tokens: {
        accessToken,
        refreshToken: rawToken,
        tokenType: 'Bearer',
        expiresIn: 900, // 15 mins
      },
    };
  }

  /**
   * Authenticates a user with email + password, supporting optional tenant slug.
   */
  async login(dto: LoginDto, ip: string) {
    const throttleKey = `${ip}:${dto.email}`;
    this.throttler.assertNotThrottled(throttleKey);

    let tenantId: string | undefined;

    if (dto.tenantSlug) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { slug: dto.tenantSlug },
      });
      if (!tenant) {
        this.throttler.recordFailedAttempt(throttleKey);
        throw new UnauthorizedException({
          code: ApiErrorCode.UNAUTHORIZED,
          message: 'Invalid credentials or tenant',
        });
      }
      tenantId = tenant.id;
    }

    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
        ...(tenantId ? { tenant_id: tenantId } : {}),
      },
      include: {
        tenant: true,
        user_branches: {
          include: { branch: true },
        },
      },
    });

    if (!user) {
      this.throttler.recordFailedAttempt(throttleKey);
      throw new UnauthorizedException({
        code: ApiErrorCode.UNAUTHORIZED,
        message: 'Invalid credentials',
      });
    }

    if (user.status !== 'ACTIVE' || user.tenant.status !== 'ACTIVE') {
      throw new UnauthorizedException({
        code: ApiErrorCode.UNAUTHORIZED,
        message: 'User account or shop is suspended/inactive',
      });
    }

    const isPasswordValid = await argon2.verify(user.password_hash, dto.password);
    if (!isPasswordValid) {
      this.throttler.recordFailedAttempt(throttleKey);
      throw new UnauthorizedException({
        code: ApiErrorCode.UNAUTHORIZED,
        message: 'Invalid credentials',
      });
    }

    // Reset failed login attempts on successful authentication
    this.throttler.reset(throttleKey);

    const defaultBranchId = user.user_branches[0]?.branch_id;

    const accessToken = this.tokenService.signAccessToken({
      sub: user.id,
      tenantId: user.tenant_id,
      role: user.role,
      email: user.email,
      name: user.name,
      branchId: defaultBranchId,
    });

    const { rawToken, tokenHash, expiresAt } = this.tokenService.generateRefreshToken();
    await this.prisma.refreshToken.create({
      data: {
        tenant_id: user.tenant_id,
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });

    return {
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
        currency: user.tenant.currency,
        vatRatePercent: Number(user.tenant.vat_rate_percent),
        allowNegativeStock: user.tenant.allow_negative_stock,
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: getRolePermissions(user.role as Role),
        branches: user.user_branches.map((ub) => ({
          id: ub.branch.id,
          name: ub.branch.name,
          code: ub.branch.code,
          isMain: ub.branch.is_main,
        })),
      },
      tokens: {
        accessToken,
        refreshToken: rawToken,
        tokenType: 'Bearer',
        expiresIn: 900,
      },
    };
  }

  /**
   * Refreshes access token with rotation (revokes old refresh token and issues a new one).
   */
  async refreshToken(dto: RefreshTokenDto) {
    const tokenHash = this.tokenService.hashToken(dto.refreshToken);

    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        token_hash: tokenHash,
        revoked: false,
        expires_at: { gt: new Date() },
      },
      include: {
        user: {
          include: {
            tenant: true,
            user_branches: true,
          },
        },
      },
    });

    if (
      !storedToken ||
      storedToken.user.status !== 'ACTIVE' ||
      storedToken.user.tenant.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException({
        code: ApiErrorCode.UNAUTHORIZED,
        message: 'Invalid or expired refresh token',
      });
    }

    // Revoke used refresh token
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked: true },
    });

    // Generate new access and refresh token
    const newAccessToken = this.tokenService.signAccessToken({
      sub: storedToken.user.id,
      tenantId: storedToken.user.tenant_id,
      role: storedToken.user.role,
      email: storedToken.user.email,
      name: storedToken.user.name,
      branchId: storedToken.user.user_branches[0]?.branch_id,
    });

    const { rawToken, tokenHash: newHash, expiresAt } = this.tokenService.generateRefreshToken();
    await this.prisma.refreshToken.create({
      data: {
        tenant_id: storedToken.user.tenant_id,
        user_id: storedToken.user.id,
        token_hash: newHash,
        expires_at: expiresAt,
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: rawToken,
      tokenType: 'Bearer',
      expiresIn: 900,
    };
  }

  /**
   * Revokes the provided refresh token.
   */
  async logout(refreshToken?: string) {
    if (refreshToken) {
      const tokenHash = this.tokenService.hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { token_hash: tokenHash },
        data: { revoked: true },
      });
    }
    return { success: true, message: 'Logged out successfully' };
  }

  /**
   * Generates a password reset token (mock email).
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
        ...(dto.tenantSlug ? { tenant: { slug: dto.tenantSlug } } : {}),
      },
    });

    // We do not leak whether user exists
    if (!user) {
      return { success: true, message: 'If an account exists, a reset link has been dispatched.' };
    }

    const { rawToken, tokenHash, expiresAt } = this.tokenService.generatePasswordResetToken();

    await this.prisma.passwordResetToken.create({
      data: {
        tenant_id: user.tenant_id,
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });

    this.logger.log(
      `[MOCK_EMAIL] Password reset token for ${user.email}: ${rawToken}`,
      'AuthService',
    );

    return {
      success: true,
      message: 'If an account exists, a reset link has been dispatched.',
      // In development / test environment, return reset token for convenience
      ...(process.env.NODE_ENV !== 'production' ? { debugToken: rawToken } : {}),
    };
  }

  /**
   * Resets password using the reset token.
   */
  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.tokenService.hashToken(dto.token);

    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        token_hash: tokenHash,
        used: false,
        expires_at: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!resetToken) {
      throw new BadRequestException({
        code: ApiErrorCode.BAD_REQUEST,
        message: 'Invalid or expired password reset token',
      });
    }

    const newPasswordHash = await argon2.hash(dto.newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.user_id },
        data: { password_hash: newPasswordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
      // Revoke all existing refresh tokens for security
      this.prisma.refreshToken.updateMany({
        where: { user_id: resetToken.user_id },
        data: { revoked: true },
      }),
    ]);

    return { success: true, message: 'Password has been reset successfully' };
  }

  /**
   * Returns current authenticated user profile, permissions, and tenant details.
   */
  async getMe(userId: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenant_id: tenantId },
      include: {
        tenant: true,
        user_branches: {
          include: { branch: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'User profile not found',
      });
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      status: user.status,
      permissions: getRolePermissions(user.role as Role),
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
        currency: user.tenant.currency,
        vatRatePercent: Number(user.tenant.vat_rate_percent),
        allowNegativeStock: user.tenant.allow_negative_stock,
      },
      branches: user.user_branches.map((ub) => ({
        id: ub.branch.id,
        name: ub.branch.name,
        code: ub.branch.code,
        isMain: ub.branch.is_main,
      })),
    };
  }
}
