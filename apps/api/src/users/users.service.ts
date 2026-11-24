import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import argon2 from 'argon2';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { ApiErrorCode, getRolePermissions, Role } from '@dokandesk/shared';

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listUsers(tenantId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { tenant_id: tenantId },
        skip,
        take: limit,
        orderBy: { created_at: 'asc' },
        include: {
          user_branches: {
            include: { branch: true },
          },
        },
      }),
      this.prisma.user.count({
        where: { tenant_id: tenantId },
      }),
    ]);

    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        phone: u.phone,
        role: u.role,
        status: u.status,
        createdAt: u.created_at,
        branches: u.user_branches.map((ub) => ({
          id: ub.branch.id,
          name: ub.branch.name,
          code: ub.branch.code,
        })),
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUser(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenant_id: tenantId },
      include: {
        user_branches: {
          include: { branch: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'User not found in this shop',
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
      createdAt: user.created_at,
      branches: user.user_branches.map((ub) => ({
        id: ub.branch.id,
        name: ub.branch.name,
        code: ub.branch.code,
      })),
    };
  }

  async createUser(tenantId: string, creatorId: string, dto: CreateUserDto) {
    const existing = await this.prisma.user.findFirst({
      where: { tenant_id: tenantId, email: dto.email },
    });

    if (existing) {
      throw new ConflictException({
        code: ApiErrorCode.BAD_REQUEST,
        message: `User with email '${dto.email}' already exists in this shop`,
      });
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          tenant_id: tenantId,
          email: dto.email,
          name: dto.name,
          phone: dto.phone,
          password_hash: passwordHash,
          role: dto.role,
        },
      });

      if (dto.branchIds?.length) {
        // Validate branches belong to this tenant
        const branches = await tx.branch.findMany({
          where: { tenant_id: tenantId, id: { in: dto.branchIds } },
        });

        if (branches.length !== dto.branchIds.length) {
          throw new BadRequestException({
            code: ApiErrorCode.BAD_REQUEST,
            message: 'One or more specified branch IDs do not belong to this shop',
          });
        }

        await tx.userBranch.createMany({
          data: dto.branchIds.map((bId) => ({
            tenant_id: tenantId,
            user_id: created.id,
            branch_id: bId,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          tenant_id: tenantId,
          user_id: creatorId,
          action: 'CREATE_USER',
          entity_type: 'User',
          entity_id: created.id,
          new_values: { email: created.email, role: created.role },
        },
      });

      return created;
    });

    return this.getUser(tenantId, user.id);
  }

  async updateUser(tenantId: string, updaterId: string, id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenant_id: tenantId },
    });

    if (!user) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'User not found in this shop',
      });
    }

    // Protect last owner from demotion or suspension
    if (user.role === Role.OWNER && (dto.role !== undefined || dto.status !== undefined)) {
      if (dto.role !== Role.OWNER || dto.status !== 'ACTIVE') {
        const ownerCount = await this.prisma.user.count({
          where: { tenant_id: tenantId, role: Role.OWNER, status: 'ACTIVE' },
        });
        if (ownerCount <= 1) {
          throw new BadRequestException({
            code: ApiErrorCode.BAD_REQUEST,
            message: 'Cannot demote or deactivate the only active owner of the shop',
          });
        }
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.role !== undefined ? { role: dto.role } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
      });

      if (dto.branchIds !== undefined) {
        // Replace branch assignments
        await tx.userBranch.deleteMany({
          where: { user_id: id, tenant_id: tenantId },
        });

        if (dto.branchIds.length > 0) {
          await tx.userBranch.createMany({
            data: dto.branchIds.map((bId) => ({
              tenant_id: tenantId,
              user_id: id,
              branch_id: bId,
            })),
          });
        }
      }

      await tx.auditLog.create({
        data: {
          tenant_id: tenantId,
          user_id: updaterId,
          action: 'UPDATE_USER',
          entity_type: 'User',
          entity_id: id,
          new_values: { role: dto.role, status: dto.status },
        },
      });
    });

    return this.getUser(tenantId, id);
  }

  async deleteUser(tenantId: string, updaterId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenant_id: tenantId },
    });

    if (!user) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'User not found in this shop',
      });
    }

    if (user.role === Role.OWNER) {
      throw new BadRequestException({
        code: ApiErrorCode.BAD_REQUEST,
        message: 'Shop owner accounts cannot be deleted',
      });
    }

    // Soft-deactivate user and revoke all refresh tokens
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { status: 'INACTIVE' },
      }),
      this.prisma.refreshToken.updateMany({
        where: { user_id: id },
        data: { revoked: true },
      }),
      this.prisma.auditLog.create({
        data: {
          tenant_id: tenantId,
          user_id: updaterId,
          action: 'DEACTIVATE_USER',
          entity_type: 'User',
          entity_id: id,
        },
      }),
    ]);

    return { success: true, message: 'User deactivated successfully' };
  }
}
