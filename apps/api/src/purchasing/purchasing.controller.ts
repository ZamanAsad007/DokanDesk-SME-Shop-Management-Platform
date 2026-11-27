import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PurchasingService } from './purchasing.service.js';
import {
  createSupplierSchema,
  updateSupplierSchema,
  supplierQuerySchema,
} from './dto/suppliers.dto.js';
import type {
  CreateSupplierDto,
  UpdateSupplierDto,
  SupplierQueryInput,
} from './dto/suppliers.dto.js';
import {
  createPurchaseInvoiceSchema,
  purchaseInvoiceQuerySchema,
} from './dto/purchase-invoices.dto.js';
import type {
  CreatePurchaseInvoiceDto,
  PurchaseInvoiceQueryInput,
} from './dto/purchase-invoices.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RbacGuard } from '../auth/guards/rbac.guard.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthTokenPayload } from '../auth/services/token.service.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { Permission } from '@dokandesk/shared';

@ApiTags('Purchasing')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('purchasing')
export class PurchasingController {
  constructor(
    @Inject(PurchasingService) private readonly purchasingService: PurchasingService,
  ) {}

  // ================= 1. SUPPLIERS =================

  @Post('suppliers')
  @RequirePermissions(Permission.PURCHASING_MANAGE)
  @ApiOperation({ summary: 'Create a new supplier' })
  async createSupplier(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthTokenPayload,
    @Body(new ZodValidationPipe(createSupplierSchema)) dto: CreateSupplierDto,
  ) {
    return this.purchasingService.createSupplier(tenantId, user.sub, dto);
  }

  @Get('suppliers')
  @RequirePermissions(Permission.PURCHASING_VIEW)
  @ApiOperation({ summary: 'List suppliers with pagination and search' })
  async listSuppliers(
    @CurrentTenant() tenantId: string,
    @Query(new ZodValidationPipe(supplierQuerySchema)) query: SupplierQueryInput,
  ) {
    return this.purchasingService.listSuppliers(tenantId, query);
  }

  @Get('suppliers/:id')
  @RequirePermissions(Permission.PURCHASING_VIEW)
  @ApiOperation({ summary: 'Get supplier details by ID' })
  async getSupplier(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.purchasingService.getSupplierById(tenantId, id);
  }

  @Put('suppliers/:id')
  @RequirePermissions(Permission.PURCHASING_MANAGE)
  @ApiOperation({ summary: 'Update supplier details' })
  async updateSupplier(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateSupplierSchema)) dto: UpdateSupplierDto,
  ) {
    return this.purchasingService.updateSupplier(tenantId, id, dto);
  }

  @Delete('suppliers/:id')
  @RequirePermissions(Permission.PURCHASING_MANAGE)
  @ApiOperation({ summary: 'Delete or deactivate supplier' })
  async deleteSupplier(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.purchasingService.deleteSupplier(tenantId, id);
  }

  // ================= 2. PURCHASE INVOICES =================

  @Post('invoices')
  @RequirePermissions(Permission.PURCHASING_RECEIVE)
  @ApiOperation({ summary: 'Create purchase invoice (goods receipt) with stock and ledger updates' })
  async createInvoice(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthTokenPayload,
    @Body(new ZodValidationPipe(createPurchaseInvoiceSchema)) dto: CreatePurchaseInvoiceDto,
  ) {
    return this.purchasingService.createInvoice(tenantId, user.sub, dto);
  }

  @Get('invoices')
  @RequirePermissions(Permission.PURCHASING_VIEW)
  @ApiOperation({ summary: 'List purchase invoices with filters' })
  async listInvoices(
    @CurrentTenant() tenantId: string,
    @Query(new ZodValidationPipe(purchaseInvoiceQuerySchema)) query: PurchaseInvoiceQueryInput,
  ) {
    return this.purchasingService.listInvoices(tenantId, query);
  }

  @Get('invoices/:id')
  @RequirePermissions(Permission.PURCHASING_VIEW)
  @ApiOperation({ summary: 'Get purchase invoice details by ID' })
  async getInvoice(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.purchasingService.getInvoiceById(tenantId, id);
  }

}
