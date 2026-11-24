import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto.js';
import { ApiErrorCode } from '@dokandesk/shared';

@Injectable()
export class TenantsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getSettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException({
        code: ApiErrorCode.TENANT_NOT_FOUND,
        message: 'Tenant settings not found',
      });
    }

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      currency: tenant.currency,
      vatRatePercent: Number(tenant.vat_rate_percent),
      allowNegativeStock: tenant.allow_negative_stock,
      createdAt: tenant.created_at,
      updatedAt: tenant.updated_at,
    };
  }

  async updateSettings(tenantId: string, userId: string, dto: UpdateTenantSettingsDto) {
    const existing = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: ApiErrorCode.TENANT_NOT_FOUND,
        message: 'Tenant not found',
      });
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.vatRatePercent !== undefined ? { vat_rate_percent: dto.vatRatePercent } : {}),
        ...(dto.allowNegativeStock !== undefined
          ? { allow_negative_stock: dto.allowNegativeStock }
          : {}),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenant_id: tenantId,
        user_id: userId,
        action: 'UPDATE_TENANT_SETTINGS',
        entity_type: 'Tenant',
        entity_id: tenantId,
        old_values: {
          name: existing.name,
          currency: existing.currency,
          vatRatePercent: Number(existing.vat_rate_percent),
          allowNegativeStock: existing.allow_negative_stock,
        },
        new_values: {
          name: updated.name,
          currency: updated.currency,
          vatRatePercent: Number(updated.vat_rate_percent),
          allowNegativeStock: updated.allow_negative_stock,
        },
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      status: updated.status,
      currency: updated.currency,
      vatRatePercent: Number(updated.vat_rate_percent),
      allowNegativeStock: updated.allow_negative_stock,
      updatedAt: updated.updated_at,
    };
  }
}
