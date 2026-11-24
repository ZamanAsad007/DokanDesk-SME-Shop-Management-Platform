import { Controller, Get, Patch, Body, UseGuards, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from './tenants.service.js';
import { updateTenantSettingsSchema } from './dto/update-tenant-settings.dto.js';
import type { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RbacGuard } from '../auth/guards/rbac.guard.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator.js';
import type { AuthTokenPayload } from '../auth/services/token.service.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { Permission } from '@dokandesk/shared';

@ApiTags('Tenants')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('tenants')
export class TenantsController {
  constructor(@Inject(TenantsService) private readonly tenantsService: TenantsService) {}

  @Get('settings')
  @RequirePermissions(Permission.SETTINGS_VIEW)
  @ApiOperation({ summary: 'Get current shop settings' })
  @ApiResponse({ status: 200, description: 'Settings retrieved successfully' })
  async getSettings(@CurrentTenant() tenantId: string) {
    return this.tenantsService.getSettings(tenantId);
  }

  @Patch('settings')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Update shop settings (VAT, currency, negative stock flag)' })
  @ApiResponse({ status: 200, description: 'Settings updated successfully' })
  async updateSettings(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthTokenPayload,
    @Body(new ZodValidationPipe(updateTenantSettingsSchema))
    dto: UpdateTenantSettingsDto,
  ) {
    return this.tenantsService.updateSettings(tenantId, user.sub, dto);
  }
}
