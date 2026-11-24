import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InventoryService } from './inventory.service.js';
import { createMovementSchema, movementQuerySchema } from './dto/stock-movement.dto.js';
import type { CreateMovementDto, MovementQueryInput } from './dto/stock-movement.dto.js';
import { stockLevelQuerySchema } from './dto/stock-level.dto.js';
import type { StockLevelQueryInput } from './dto/stock-level.dto.js';
import {
  recordOpeningStockSchema,
  recordAdjustmentSchema,
  recordDamageSchema,
  createTransferSchema,
  transferQuerySchema,
} from './dto/stock-operations.dto.js';
import type {
  RecordOpeningStockDto,
  RecordAdjustmentDto,
  RecordDamageDto,
  CreateTransferDto,
  TransferQueryInput,
} from './dto/stock-operations.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RbacGuard } from '../auth/guards/rbac.guard.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthTokenPayload } from '../auth/services/token.service.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { Permission } from '@dokandesk/shared';

@ApiTags('Inventory')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('inventory')
export class InventoryController {
  constructor(
    @Inject(InventoryService) private readonly inventoryService: InventoryService,
  ) {}

  @Get('levels')
  @RequirePermissions(Permission.INVENTORY_VIEW)
  @ApiOperation({ summary: 'List stock levels by branch, product, or low-stock' })
  async getStockLevels(
    @CurrentTenant() tenantId: string,
    @Query(new ZodValidationPipe(stockLevelQuerySchema)) query: StockLevelQueryInput,
  ) {
    return this.inventoryService.getStockLevels(tenantId, query);
  }

  @Get('low-stock')
  @RequirePermissions(Permission.INVENTORY_VIEW)
  @ApiOperation({ summary: 'Get list of low-stock alerts across branches' })
  async getLowStockAlerts(
    @CurrentTenant() tenantId: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.inventoryService.getLowStockAlerts(tenantId, branchId);
  }

  @Get('levels/:branchId/:productId')
  @RequirePermissions(Permission.INVENTORY_VIEW)
  @ApiOperation({ summary: 'Get stock level for a specific branch and product' })
  async getStockLevel(
    @CurrentTenant() tenantId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.inventoryService.getStockLevel(tenantId, branchId, productId);
  }

  @Get('movements')
  @RequirePermissions(Permission.INVENTORY_VIEW)
  @ApiOperation({ summary: 'List stock movements with history and filters' })
  async getMovements(
    @CurrentTenant() tenantId: string,
    @Query(new ZodValidationPipe(movementQuerySchema)) query: MovementQueryInput,
  ) {
    return this.inventoryService.getMovements(tenantId, query);
  }

  @Post('movements')
  @RequirePermissions(Permission.INVENTORY_ADJUST)
  @ApiOperation({ summary: 'Record a raw stock movement' })
  async recordMovement(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthTokenPayload,
    @Body(new ZodValidationPipe(createMovementSchema)) dto: CreateMovementDto,
  ) {
    return this.inventoryService.recordMovement({
      tenantId,
      branchId: dto.branchId,
      productId: dto.productId,
      type: dto.type,
      quantity: dto.quantity,
      unitCostPaisa: dto.unitCostPaisa,
      referenceType: dto.referenceType,
      referenceId: dto.referenceId,
      notes: dto.notes,
      userId: user.sub,
    });
  }

  @Post('opening')
  @RequirePermissions(Permission.INVENTORY_ADJUST)
  @ApiOperation({ summary: 'Record opening stock and calculate weighted-average cost' })
  async recordOpeningStock(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthTokenPayload,
    @Body(new ZodValidationPipe(recordOpeningStockSchema)) dto: RecordOpeningStockDto,
  ) {
    return this.inventoryService.recordOpeningStock(tenantId, user.sub, dto);
  }

  @Post('adjustments')
  @RequirePermissions(Permission.INVENTORY_ADJUST)
  @ApiOperation({ summary: 'Record manual stock adjustment with approval tracking' })
  async recordAdjustment(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthTokenPayload,
    @Body(new ZodValidationPipe(recordAdjustmentSchema)) dto: RecordAdjustmentDto,
  ) {
    return this.inventoryService.recordAdjustment(tenantId, user.sub, dto);
  }

  @Get('adjustments')
  @RequirePermissions(Permission.INVENTORY_VIEW)
  @ApiOperation({ summary: 'List stock adjustments' })
  async listAdjustments(
    @CurrentTenant() tenantId: string,
    @Query('branchId') branchId?: string,
    @Query('productId') productId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.inventoryService.listAdjustments(tenantId, {
      branchId,
      productId,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Post('damage')
  @RequirePermissions(Permission.INVENTORY_ADJUST)
  @ApiOperation({ summary: 'Record damaged or expired inventory' })
  async recordDamage(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthTokenPayload,
    @Body(new ZodValidationPipe(recordDamageSchema)) dto: RecordDamageDto,
  ) {
    return this.inventoryService.recordDamage(tenantId, user.sub, dto);
  }

  @Post('transfers')
  @RequirePermissions(Permission.INVENTORY_TRANSFER)
  @ApiOperation({ summary: 'Create and dispatch branch stock transfer' })
  async createTransfer(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthTokenPayload,
    @Body(new ZodValidationPipe(createTransferSchema)) dto: CreateTransferDto,
  ) {
    return this.inventoryService.createTransfer(tenantId, user.sub, dto);
  }

  @Post('transfers/:id/receive')
  @RequirePermissions(Permission.INVENTORY_TRANSFER)
  @ApiOperation({ summary: 'Receive dispatched branch stock transfer' })
  async receiveTransfer(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.inventoryService.receiveTransfer(tenantId, user.sub, id);
  }

  @Get('transfers')
  @RequirePermissions(Permission.INVENTORY_VIEW)
  @ApiOperation({ summary: 'List branch stock transfers' })
  async listTransfers(
    @CurrentTenant() tenantId: string,
    @Query(new ZodValidationPipe(transferQuerySchema)) query: TransferQueryInput,
  ) {
    return this.inventoryService.listTransfers(tenantId, query);
  }
}
