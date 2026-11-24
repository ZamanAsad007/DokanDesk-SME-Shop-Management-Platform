import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { CreateBranchDto } from './dto/create-branch.dto.js';
import { UpdateBranchDto } from './dto/update-branch.dto.js';
import { ApiErrorCode } from '@dokandesk/shared';

@Injectable()
export class BranchesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listBranches(tenantId: string) {
    return this.prisma.branch.findMany({
      where: { tenant_id: tenantId },
      orderBy: [{ is_main: 'desc' }, { created_at: 'asc' }],
    });
  }

  async getBranch(tenantId: string, id: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, tenant_id: tenantId },
    });

    if (!branch) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Branch not found',
      });
    }

    return branch;
  }

  async createBranch(tenantId: string, userId: string, dto: CreateBranchDto) {
    const existing = await this.prisma.branch.findFirst({
      where: { tenant_id: tenantId, code: dto.code },
    });

    if (existing) {
      throw new ConflictException({
        code: ApiErrorCode.BAD_REQUEST,
        message: `Branch code '${dto.code}' already exists in this shop`,
      });
    }

    const branch = await this.prisma.$transaction(async (tx) => {
      if (dto.isMain) {
        // Demote existing main branches
        await tx.branch.updateMany({
          where: { tenant_id: tenantId, is_main: true },
          data: { is_main: false },
        });
      }

      const created = await tx.branch.create({
        data: {
          tenant_id: tenantId,
          name: dto.name,
          code: dto.code,
          is_main: dto.isMain,
          address: dto.address,
          phone: dto.phone,
        },
      });

      await tx.auditLog.create({
        data: {
          tenant_id: tenantId,
          user_id: userId,
          action: 'CREATE_BRANCH',
          entity_type: 'Branch',
          entity_id: created.id,
          new_values: { name: created.name, code: created.code },
        },
      });

      return created;
    });

    return branch;
  }

  async updateBranch(tenantId: string, userId: string, id: string, dto: UpdateBranchDto) {
    const branch = await this.getBranch(tenantId, id);

    if (dto.code && dto.code !== branch.code) {
      const codeExists = await this.prisma.branch.findFirst({
        where: { tenant_id: tenantId, code: dto.code, NOT: { id } },
      });
      if (codeExists) {
        throw new ConflictException({
          code: ApiErrorCode.BAD_REQUEST,
          message: `Branch code '${dto.code}' already exists in this shop`,
        });
      }
    }

    const updated = await this.prisma.branch.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenant_id: tenantId,
        user_id: userId,
        action: 'UPDATE_BRANCH',
        entity_type: 'Branch',
        entity_id: id,
        old_values: { name: branch.name, code: branch.code },
        new_values: { name: updated.name, code: updated.code },
      },
    });

    return updated;
  }

  async deleteBranch(tenantId: string, userId: string, id: string) {
    const branch = await this.getBranch(tenantId, id);

    if (branch.is_main) {
      throw new BadRequestException({
        code: ApiErrorCode.BAD_REQUEST,
        message: 'Cannot delete the main branch of a shop',
      });
    }

    await this.prisma.branch.delete({
      where: { id },
    });

    await this.prisma.auditLog.create({
      data: {
        tenant_id: tenantId,
        user_id: userId,
        action: 'DELETE_BRANCH',
        entity_type: 'Branch',
        entity_id: id,
        old_values: { name: branch.name, code: branch.code },
      },
    });

    return { success: true, message: 'Branch deleted successfully' };
  }
}
