import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { StockMovementType, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { ApiErrorCode, calculateWeightedAverageCost } from '@dokandesk/shared';
import type { MovementQueryInput } from './dto/stock-movement.dto.js';
import type { StockLevelQueryInput } from './dto/stock-level.dto.js';
import type {
  RecordOpeningStockDto,
  RecordAdjustmentDto,
  RecordDamageDto,
  CreateTransferDto,
  TransferQueryInput,
} from './dto/stock-operations.dto.js';

export interface RecordMovementParams {
  tenantId: string;
  branchId: string;
  productId: string;
  type: StockMovementType;
  quantity: number;
  unitCostPaisa?: number | bigint;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  userId?: string;
}

@Injectable()
export class InventoryService implements OnModuleInit {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    // Ensure append-only DB trigger on stock_movements
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION prevent_stock_movement_mutation()
        RETURNS TRIGGER AS $$
        BEGIN
          RAISE EXCEPTION 'stock_movements is append-only: updates and deletes are forbidden';
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trg_stock_movements_append_only ON stock_movements;
        CREATE TRIGGER trg_stock_movements_append_only
        BEFORE UPDATE OR DELETE ON stock_movements
        FOR EACH ROW
        EXECUTE FUNCTION prevent_stock_movement_mutation();
      `);
    } catch {
      // Non-blocking for environments that manage DB externally
    }
  }

  /**
   * Internal transaction-bound stock movement recorder.
   * Atomically locks stock_level row FOR UPDATE, enforces negative stock invariant,
   * creates append-only movement, and updates stock level.
   */
  async recordMovementInternal(
    tx: Prisma.TransactionClient,
    params: RecordMovementParams,
  ) {
    const {
      tenantId,
      branchId,
      productId,
      type,
      quantity,
      unitCostPaisa = 0,
      referenceType,
      referenceId,
      notes,
      userId,
    } = params;

    // 1. Verify tenant & settings
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, allow_negative_stock: true },
    });

    if (!tenant) {
      throw new NotFoundException({
        code: ApiErrorCode.TENANT_NOT_FOUND,
        message: 'Tenant not found',
      });
    }

    // 2. Verify product & branch belong to tenant
    const product = await tx.product.findFirst({
      where: { id: productId, tenant_id: tenantId },
      select: { id: true, reorder_level: true, cost_price: true, selling_price: true },
    });

    if (!product) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Product not found for this tenant',
      });
    }

    const branch = await tx.branch.findFirst({
      where: { id: branchId, tenant_id: tenantId },
      select: { id: true },
    });

    if (!branch) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Branch not found for this tenant',
      });
    }

    // 3. Atomically ensure stock_level row exists and lock it for update
    await tx.$executeRaw`
      INSERT INTO stock_levels (id, tenant_id, branch_id, product_id, current_quantity, reserved_quantity, reorder_point, updated_at)
      VALUES (gen_random_uuid(), ${tenantId}::uuid, ${branchId}::uuid, ${productId}::uuid, 0, 0, ${product.reorder_level}, NOW())
      ON CONFLICT (tenant_id, branch_id, product_id) DO NOTHING
    `;

    const [stockLevelRow] = await tx.$queryRaw<
      Array<{
        id: string;
        current_quantity: string;
        reserved_quantity: string;
        reorder_point: string;
      }>
    >`
      SELECT id, current_quantity, reserved_quantity, reorder_point
      FROM stock_levels
      WHERE tenant_id = ${tenantId}::uuid AND branch_id = ${branchId}::uuid AND product_id = ${productId}::uuid
      FOR UPDATE
    `;

    const currentQty = Number(stockLevelRow.current_quantity);
    const newQty = currentQty + quantity;

    // 4. Invariant check: negative stock rule
    if (!tenant.allow_negative_stock && newQty < 0) {
      throw new BadRequestException({
        code: ApiErrorCode.NEGATIVE_STOCK_NOT_ALLOWED,
        message: `Operation rejected: negative stock is not allowed. Available: ${currentQty}, Requested change: ${quantity}, Resulting: ${newQty}`,
      });
    }

    // 5. Append stock movement
    const movement = await tx.stockMovement.create({
      data: {
        tenant_id: tenantId,
        branch_id: branchId,
        product_id: productId,
        type,
        quantity: new Prisma.Decimal(quantity),
        unit_cost_paisa: BigInt(unitCostPaisa),
        reference_type: referenceType,
        reference_id: referenceId,
        notes,
        created_by: userId,
      },
    });

    // 6. Update cached stock level
    const updatedStockLevel = await tx.stockLevel.update({
      where: { id: stockLevelRow.id },
      data: {
        current_quantity: new Prisma.Decimal(newQty),
      },
    });

    return {
      movement,
      stockLevel: updatedStockLevel,
      currentQty,
      newQty,
      product,
    };
  }

  /**
   * Atomically records an append-only stock movement and updates the cached stock level.
   */
  async recordMovement(params: RecordMovementParams) {
    return await this.prisma.$transaction(async (tx) => {
      const result = await this.recordMovementInternal(tx, params);
      return {
        movement: result.movement,
        stockLevel: result.stockLevel,
      };
    });
  }

  /**
   * Records opening stock, initializes stock level, and recalculates weighted average cost.
   */
  async recordOpeningStock(
    tenantId: string,
    userId: string,
    dto: RecordOpeningStockDto,
  ) {
    return await this.prisma.$transaction(async (tx) => {
      const result = await this.recordMovementInternal(tx, {
        tenantId,
        branchId: dto.branchId,
        productId: dto.productId,
        type: StockMovementType.OPENING,
        quantity: dto.quantity,
        unitCostPaisa: dto.unitCostPaisa,
        notes: dto.notes ?? 'Initial opening stock',
        userId,
      });

      // Recalculate weighted-average cost
      const newCostPaisa = calculateWeightedAverageCost({
        currentQty: result.currentQty,
        currentCostPaisa: Number(result.product.cost_price),
        incomingQty: dto.quantity,
        incomingCostPaisa: dto.unitCostPaisa,
      });

      if (BigInt(newCostPaisa) !== result.product.cost_price) {
        await tx.product.update({
          where: { id: dto.productId },
          data: { cost_price: BigInt(newCostPaisa) },
        });

        await tx.priceHistory.create({
          data: {
            tenant_id: tenantId,
            product_id: dto.productId,
            old_cost_price: result.product.cost_price,
            new_cost_price: BigInt(newCostPaisa),
            old_selling_price: result.product.selling_price,
            new_selling_price: result.product.selling_price,
            change_reason: 'Opening stock weighted average cost update',
            changed_by: userId,
          },
        });
      }

      return {
        movement: result.movement,
        stockLevel: result.stockLevel,
        updatedCostPricePaisa: newCostPaisa,
      };
    });
  }

  /**
   * Records a manual stock adjustment with approval and reason tracking.
   */
  async recordAdjustment(
    tenantId: string,
    userId: string,
    dto: RecordAdjustmentDto,
  ) {
    return await this.prisma.$transaction(async (tx) => {
      const adjustment = await tx.stockAdjustment.create({
        data: {
          tenant_id: tenantId,
          branch_id: dto.branchId,
          product_id: dto.productId,
          reason: dto.reason,
          quantity_delta: new Prisma.Decimal(dto.quantityDelta),
          status: 'APPROVED',
          approved_by: userId,
          created_by: userId,
          notes: dto.notes,
        },
      });

      const result = await this.recordMovementInternal(tx, {
        tenantId,
        branchId: dto.branchId,
        productId: dto.productId,
        type: StockMovementType.ADJUSTMENT,
        quantity: dto.quantityDelta,
        referenceType: 'stock_adjustment',
        referenceId: adjustment.id,
        notes: dto.notes ? `${dto.reason}: ${dto.notes}` : dto.reason,
        userId,
      });

      return {
        adjustment,
        movement: result.movement,
        stockLevel: result.stockLevel,
      };
    });
  }

  /**
   * Records damaged or spoiled goods.
   */
  async recordDamage(
    tenantId: string,
    userId: string,
    dto: RecordDamageDto,
  ) {
    return await this.prisma.$transaction(async (tx) => {
      const result = await this.recordMovementInternal(tx, {
        tenantId,
        branchId: dto.branchId,
        productId: dto.productId,
        type: StockMovementType.DAMAGE,
        quantity: -dto.quantity,
        notes: dto.notes ? `${dto.reason}: ${dto.notes}` : dto.reason,
        userId,
      });

      return {
        movement: result.movement,
        stockLevel: result.stockLevel,
      };
    });
  }

  /**
   * Creates and dispatches a stock transfer from one branch to another.
   */
  async createTransfer(
    tenantId: string,
    userId: string,
    dto: CreateTransferDto,
  ) {
    return await this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.create({
        data: {
          tenant_id: tenantId,
          from_branch_id: dto.fromBranchId,
          to_branch_id: dto.toBranchId,
          status: 'DISPATCHED',
          notes: dto.notes,
          created_by: userId,
          items: {
            create: dto.items.map((item) => ({
              tenant_id: tenantId,
              product_id: item.productId,
              quantity: new Prisma.Decimal(item.quantity),
            })),
          },
        },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
          },
          from_branch: { select: { id: true, name: true, code: true } },
          to_branch: { select: { id: true, name: true, code: true } },
        },
      });

      // Deduct stock at source branch
      for (const item of dto.items) {
        await this.recordMovementInternal(tx, {
          tenantId,
          branchId: dto.fromBranchId,
          productId: item.productId,
          type: StockMovementType.TRANSFER_OUT,
          quantity: -item.quantity,
          referenceType: 'stock_transfer',
          referenceId: transfer.id,
          notes: `Transfer out to branch ${dto.toBranchId}`,
          userId,
        });
      }

      return transfer;
    });
  }

  /**
   * Receives a dispatched stock transfer into the destination branch.
   */
  async receiveTransfer(tenantId: string, userId: string, transferId: string) {
    return await this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findFirst({
        where: { id: transferId, tenant_id: tenantId },
        include: { items: true },
      });

      if (!transfer) {
        throw new NotFoundException({
          code: ApiErrorCode.NOT_FOUND,
          message: 'Transfer not found',
        });
      }

      if (transfer.status !== 'DISPATCHED') {
        throw new BadRequestException({
          code: ApiErrorCode.BAD_REQUEST,
          message: `Transfer cannot be received because it is currently ${transfer.status}`,
        });
      }

      // Add stock at destination branch
      for (const item of transfer.items) {
        await this.recordMovementInternal(tx, {
          tenantId,
          branchId: transfer.to_branch_id,
          productId: item.product_id,
          type: StockMovementType.TRANSFER_IN,
          quantity: Number(item.quantity),
          referenceType: 'stock_transfer',
          referenceId: transfer.id,
          notes: `Transfer in from branch ${transfer.from_branch_id}`,
          userId,
        });
      }

      return await tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: 'RECEIVED',
        },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
          },
          from_branch: { select: { id: true, name: true, code: true } },
          to_branch: { select: { id: true, name: true, code: true } },
        },
      });
    });
  }

  /**
   * Lists stock transfers with pagination.
   */
  async listTransfers(tenantId: string, query: TransferQueryInput) {
    const { branchId, status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.StockTransferWhereInput = {
      tenant_id: tenantId,
      ...(status ? { status } : {}),
      ...(branchId
        ? {
            OR: [
              { from_branch_id: branchId },
              { to_branch_id: branchId },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.stockTransfer.count({ where }),
      this.prisma.stockTransfer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
          },
          from_branch: { select: { id: true, name: true, code: true } },
          to_branch: { select: { id: true, name: true, code: true } },
        },
      }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Lists adjustments with pagination.
   */
  async listAdjustments(
    tenantId: string,
    query: { branchId?: string; productId?: string; page?: number; limit?: number },
  ) {
    const { branchId, productId, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.StockAdjustmentWhereInput = {
      tenant_id: tenantId,
      ...(branchId ? { branch_id: branchId } : {}),
      ...(productId ? { product_id: productId } : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.stockAdjustment.count({ where }),
      this.prisma.stockAdjustment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          branch: { select: { id: true, name: true, code: true } },
        },
      }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Returns list of low-stock alerts across branches.
   */
  async getLowStockAlerts(tenantId: string, branchId?: string) {
    return this.getStockLevels(tenantId, {
      branchId,
      lowStockOnly: true,
      page: 1,
      limit: 100,
    });
  }

  /**
   * Lists stock levels by tenant with branch, product, and low-stock filters.
   */
  async getStockLevels(tenantId: string, query: StockLevelQueryInput) {
    const { branchId, productId, lowStockOnly, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    if (lowStockOnly) {
      // Use raw query for column comparison (current_quantity <= reorder_point)
      const countResult = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint as count
        FROM stock_levels
        WHERE tenant_id = ${tenantId}::uuid
          ${branchId ? Prisma.sql`AND branch_id = ${branchId}::uuid` : Prisma.empty}
          ${productId ? Prisma.sql`AND product_id = ${productId}::uuid` : Prisma.empty}
          AND current_quantity <= reorder_point
      `;
      const total = Number(countResult[0]?.count ?? 0);

      const items = await this.prisma.$queryRaw<
        Array<{
          id: string;
          tenant_id: string;
          branch_id: string;
          product_id: string;
          current_quantity: string;
          reserved_quantity: string;
          reorder_point: string;
          updated_at: Date;
          product_name: string;
          product_sku: string;
          branch_name: string;
        }>
      >`
        SELECT sl.id, sl.tenant_id, sl.branch_id, sl.product_id,
               sl.current_quantity, sl.reserved_quantity, sl.reorder_point, sl.updated_at,
               p.name as product_name, p.sku as product_sku,
               b.name as branch_name
        FROM stock_levels sl
        JOIN products p ON sl.product_id = p.id
        JOIN branches b ON sl.branch_id = b.id
        WHERE sl.tenant_id = ${tenantId}::uuid
          ${branchId ? Prisma.sql`AND sl.branch_id = ${branchId}::uuid` : Prisma.empty}
          ${productId ? Prisma.sql`AND sl.product_id = ${productId}::uuid` : Prisma.empty}
          AND sl.current_quantity <= sl.reorder_point
        ORDER BY sl.current_quantity ASC
        LIMIT ${limit} OFFSET ${skip}
      `;

      return {
        items: items.map((item) => ({
          ...item,
          current_quantity: Number(item.current_quantity),
          reserved_quantity: Number(item.reserved_quantity),
          reorder_point: Number(item.reorder_point),
          product: { id: item.product_id, name: item.product_name, sku: item.product_sku },
          branch: { id: item.branch_id, name: item.branch_name },
        })),
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    const where: Prisma.StockLevelWhereInput = {
      tenant_id: tenantId,
      ...(branchId ? { branch_id: branchId } : {}),
      ...(productId ? { product_id: productId } : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.stockLevel.count({ where }),
      this.prisma.stockLevel.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updated_at: 'desc' },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              barcode: true,
              selling_price: true,
              cost_price: true,
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves stock level for a single branch and product.
   */
  async getStockLevel(tenantId: string, branchId: string, productId: string) {
    const level = await this.prisma.stockLevel.findUnique({
      where: {
        tenant_id_branch_id_product_id: {
          tenant_id: tenantId,
          branch_id: branchId,
          product_id: productId,
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            reorder_level: true,
            cost_price: true,
            selling_price: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!level) {
      return {
        tenant_id: tenantId,
        branch_id: branchId,
        product_id: productId,
        current_quantity: 0,
        reserved_quantity: 0,
        reorder_point: 0,
      };
    }

    return level;
  }

  /**
   * Lists stock movements with filters.
   */
  async getMovements(tenantId: string, query: MovementQueryInput) {
    const { branchId, productId, type, fromDate, toDate, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.StockMovementWhereInput = {
      tenant_id: tenantId,
      ...(branchId ? { branch_id: branchId } : {}),
      ...(productId ? { product_id: productId } : {}),
      ...(type ? { type } : {}),
      ...(fromDate || toDate
        ? {
            created_at: {
              ...(fromDate ? { gte: new Date(fromDate) } : {}),
              ...(toDate ? { lte: new Date(toDate) } : {}),
            },
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.stockMovement.count({ where }),
      this.prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          product: {
            select: { id: true, name: true, sku: true },
          },
          branch: {
            select: { id: true, name: true, code: true },
          },
        },
      }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
