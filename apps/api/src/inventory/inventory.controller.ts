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
}
