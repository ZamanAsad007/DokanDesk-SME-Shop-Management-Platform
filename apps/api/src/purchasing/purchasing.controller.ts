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
import {
  createSupplierPaymentSchema,
  supplierPaymentQuerySchema,
} from './dto/supplier-payments.dto.js';
import type {
  CreateSupplierPaymentDto,
  SupplierPaymentQueryInput,
} from './dto/supplier-payments.dto.js';
import {
  createPurchaseReturnSchema,
  purchaseReturnQuerySchema,
} from './dto/purchase-returns.dto.js';
import type {
  CreatePurchaseReturnDto,
  PurchaseReturnQueryInput,
} from './dto/purchase-returns.dto.js';
import { supplierLedgerQuerySchema } from './dto/supplier-ledger.dto.js';
import type { SupplierLedgerQueryInput } from './dto/supplier-ledger.dto.js';
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

  // ================= 3. SUPPLIER PAYMENTS =================

  @Post('payments')
  @RequirePermissions(Permission.PURCHASING_PAY)
  @ApiOperation({ summary: 'Record payment to supplier and update ledger' })
  async createPayment(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthTokenPayload,
    @Body(new ZodValidationPipe(createSupplierPaymentSchema)) dto: CreateSupplierPaymentDto,
  ) {
    return this.purchasingService.createPayment(tenantId, user.sub, dto);
  }

  @Get('payments')
  @RequirePermissions(Permission.PURCHASING_VIEW)
  @ApiOperation({ summary: 'List supplier payments' })
  async listPayments(
    @CurrentTenant() tenantId: string,
    @Query(new ZodValidationPipe(supplierPaymentQuerySchema)) query: SupplierPaymentQueryInput,
  ) {
    return this.purchasingService.listPayments(tenantId, query);
  }

  // ================= 4. PURCHASE RETURNS =================

  @Post('returns')
  @RequirePermissions(Permission.PURCHASING_RECEIVE)
  @ApiOperation({ summary: 'Record purchase return, deduct stock, and update supplier ledger' })
  async createReturn(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthTokenPayload,
    @Body(new ZodValidationPipe(createPurchaseReturnSchema)) dto: CreatePurchaseReturnDto,
  ) {
    return this.purchasingService.createReturn(tenantId, user.sub, dto);
  }

  @Get('returns')
  @RequirePermissions(Permission.PURCHASING_VIEW)
  @ApiOperation({ summary: 'List purchase returns' })
  async listReturns(
    @CurrentTenant() tenantId: string,
    @Query(new ZodValidationPipe(purchaseReturnQuerySchema)) query: PurchaseReturnQueryInput,
  ) {
    return this.purchasingService.listReturns(tenantId, query);
  }

  @Get('returns/:id')
  @RequirePermissions(Permission.PURCHASING_VIEW)
  @ApiOperation({ summary: 'Get purchase return by ID' })
  async getReturn(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.purchasingService.getReturnById(tenantId, id);
  }

  // ================= 5. SUPPLIER LEDGER & PAYABLES =================

  @Get('suppliers/:id/ledger')
  @RequirePermissions(Permission.PURCHASING_VIEW)
  @ApiOperation({ summary: 'Get append-only supplier ledger entries' })
  async getSupplierLedger(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(supplierLedgerQuerySchema)) query: SupplierLedgerQueryInput,
  ) {
    return this.purchasingService.getSupplierLedger(tenantId, id, query);
  }

  @Get('payables')
  @RequirePermissions(Permission.PURCHASING_VIEW)
  @ApiOperation({ summary: 'Get total payables report across suppliers' })
  async getPayablesReport(@CurrentTenant() tenantId: string) {
    return this.purchasingService.getPayablesReport(tenantId);
  }
}
