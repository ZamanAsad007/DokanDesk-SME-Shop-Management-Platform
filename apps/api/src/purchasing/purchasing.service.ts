import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
  OnModuleInit,
} from '@nestjs/common';
import {
  StockMovementType,
  PurchaseInvoiceStatus,
  SupplierLedgerEntryType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import {
  calculatePurchaseInvoiceTotals,
  calculateWeightedAverageCost,
  ApiErrorCode,
} from '@dokandesk/shared';
import type {
  CreateSupplierDto,
  UpdateSupplierDto,
  SupplierQueryInput,
} from './dto/suppliers.dto.js';
import type {
  CreatePurchaseInvoiceDto,
  PurchaseInvoiceQueryInput,
} from './dto/purchase-invoices.dto.js';

@Injectable()
export class PurchasingService implements OnModuleInit {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(InventoryService) private readonly inventoryService: InventoryService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Ensure append-only DB trigger on supplier_ledger (Invariant 7 / ADR 004)
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION prevent_supplier_ledger_mutation()
        RETURNS TRIGGER AS $$
        BEGIN
          RAISE EXCEPTION 'supplier_ledger is append-only: updates and deletes are forbidden';
        END;
        $$ LANGUAGE plpgsql;
      `);
      await this.prisma.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS trg_supplier_ledger_append_only ON supplier_ledger;
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE TRIGGER trg_supplier_ledger_append_only
        BEFORE UPDATE OR DELETE ON supplier_ledger
        FOR EACH ROW
        EXECUTE FUNCTION prevent_supplier_ledger_mutation();
      `);
    } catch {
      // Non-blocking for environments that manage DB triggers externally
    }
  }

  // ================= 1. SUPPLIERS CRUD =================

  async createSupplier(tenantId: string, userId: string, dto: CreateSupplierDto) {
    const existing = await this.prisma.supplier.findFirst({
      where: { tenant_id: tenantId, name: dto.name },
    });

    if (existing) {
      throw new ConflictException({
        code: ApiErrorCode.BAD_REQUEST,
        message: `Supplier with name "${dto.name}" already exists`,
      });
    }

    const openingBalancePaisa = BigInt(dto.openingBalancePaisa ?? 0);

    return await this.prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.create({
        data: {
          tenant_id: tenantId,
          name: dto.name,
          contact_person: dto.contactPerson,
          phone: dto.phone,
          email: dto.email,
          address: dto.address,
          opening_balance_paisa: openingBalancePaisa,
          current_balance_paisa: openingBalancePaisa,
        },
      });

      if (openingBalancePaisa !== 0n) {
        await tx.supplierLedger.create({
          data: {
            tenant_id: tenantId,
            supplier_id: supplier.id,
            type: SupplierLedgerEntryType.ADJUSTMENT,
            amount_paisa: openingBalancePaisa,
            balance_after_paisa: openingBalancePaisa,
            reference_type: 'OPENING_BALANCE',
            reference_id: supplier.id,
            notes: 'Initial supplier opening balance',
            created_by: userId,
          },
        });
      }

      return supplier;
    });
  }

  async listSuppliers(tenantId: string, query: SupplierQueryInput) {
    const where: Prisma.SupplierWhereInput = {
      tenant_id: tenantId,
      ...(query.isActive !== undefined ? { is_active: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { contact_person: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, suppliers] = await Promise.all([
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      data: suppliers,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        hasMore: query.page * query.limit < total,
      },
    };
  }

  async getSupplierById(tenantId: string, supplierId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenant_id: tenantId },
    });

    if (!supplier) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Supplier not found',
      });
    }

    return supplier;
  }

  async updateSupplier(
    tenantId: string,
    supplierId: string,
    dto: UpdateSupplierDto,
  ) {
    await this.getSupplierById(tenantId, supplierId);

    if (dto.name) {
      const conflict = await this.prisma.supplier.findFirst({
        where: {
          tenant_id: tenantId,
          name: dto.name,
          id: { not: supplierId },
        },
      });

      if (conflict) {
        throw new ConflictException({
          code: ApiErrorCode.BAD_REQUEST,
          message: `Supplier with name "${dto.name}" already exists`,
        });
      }
    }

    return await this.prisma.supplier.update({
      where: { id: supplierId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.contactPerson !== undefined ? { contact_person: dto.contactPerson } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.isActive !== undefined ? { is_active: dto.isActive } : {}),
      },
    });
  }

  async deleteSupplier(tenantId: string, supplierId: string) {
    await this.getSupplierById(tenantId, supplierId);

    const [invoiceCount, paymentCount] = await Promise.all([
      this.prisma.purchaseInvoice.count({
        where: { tenant_id: tenantId, supplier_id: supplierId },
      }),
      this.prisma.supplierPayment.count({
        where: { tenant_id: tenantId, supplier_id: supplierId },
      }),
    ]);

    if (invoiceCount > 0 || paymentCount > 0) {
      // Soft-deactivate if transactions exist
      return await this.prisma.supplier.update({
        where: { id: supplierId },
        data: { is_active: false },
      });
    }

    return await this.prisma.supplier.delete({
      where: { id: supplierId },
    });
  }

  // ================= 2. PURCHASE INVOICES (GOODS RECEIPT) =================

  async createInvoice(
    tenantId: string,
    userId: string,
    dto: CreatePurchaseInvoiceDto,
  ) {
    // 1. Verify supplier & branch belong to tenant
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, tenant_id: tenantId },
    });
    if (!supplier) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Supplier not found for this tenant',
      });
    }

    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, tenant_id: tenantId },
    });
    if (!branch) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Branch not found for this tenant',
      });
    }

    // 2. Verify invoice number uniqueness per supplier
    const existingInvoice = await this.prisma.purchaseInvoice.findFirst({
      where: {
        tenant_id: tenantId,
        supplier_id: dto.supplierId,
        invoice_number: dto.invoiceNumber,
      },
    });
    if (existingInvoice) {
      throw new BadRequestException({
        code: ApiErrorCode.BAD_REQUEST,
        message: `Invoice number "${dto.invoiceNumber}" already exists for this supplier`,
      });
    }

    // 3. Calculate financial totals
    const totals = calculatePurchaseInvoiceTotals({
      items: dto.items,
      discountPaisa: dto.discountPaisa,
      taxPaisa: dto.taxPaisa,
      shippingCostPaisa: dto.shippingCostPaisa,
    });

    const totalInvoicePaisa = BigInt(totals.totalPaisa);
    const paidAmountPaisa = BigInt(dto.paidAmountPaisa ?? 0);

    if (paidAmountPaisa > totalInvoicePaisa) {
      throw new BadRequestException({
        code: ApiErrorCode.INVALID_PAYMENT_SUM,
        message: 'Paid amount cannot exceed total invoice amount',
      });
    }

    // 4. Atomically record invoice, stock movements, weighted-avg cost, and supplier ledger
    return await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.purchaseInvoice.create({
        data: {
          tenant_id: tenantId,
          supplier_id: dto.supplierId,
          branch_id: dto.branchId,
          po_id: dto.poId,
          invoice_number: dto.invoiceNumber,
          status: dto.status,
          invoice_date: dto.invoiceDate ?? new Date(),
          received_date: dto.receivedDate ?? new Date(),
          subtotal_paisa: BigInt(totals.itemsSubtotalPaisa),
          discount_paisa: BigInt(dto.discountPaisa ?? 0),
          tax_paisa: BigInt(dto.taxPaisa ?? 0),
          shipping_cost_paisa: BigInt(dto.shippingCostPaisa ?? 0),
          total_paisa: totalInvoicePaisa,
          paid_amount_paisa: paidAmountPaisa,
          notes: dto.notes,
          created_by: userId,
        },
      });

      // Insert invoice line items
      for (const item of dto.items) {
        const lineSubtotalPaisa = BigInt(Math.round(item.quantity * item.unitCostPaisa));

        await tx.purchaseInvoiceItem.create({
          data: {
            tenant_id: tenantId,
            purchase_invoice_id: invoice.id,
            product_id: item.productId,
            quantity: new Prisma.Decimal(item.quantity),
            unit_cost_paisa: BigInt(item.unitCostPaisa),
            subtotal_paisa: lineSubtotalPaisa,
          },
        });

        // If status is RECEIVED, record stock intake and recalculate weighted average cost
        if (dto.status === PurchaseInvoiceStatus.RECEIVED) {
          const result = await this.inventoryService.recordMovementInternal(tx, {
            tenantId,
            branchId: dto.branchId,
            productId: item.productId,
            type: StockMovementType.PURCHASE,
            quantity: item.quantity,
            unitCostPaisa: item.unitCostPaisa,
            referenceType: 'PURCHASE_INVOICE',
            referenceId: invoice.id,
            notes: `Purchase invoice receipt: ${invoice.invoice_number}`,
            userId,
          });

          // Recalculate weighted-average cost
          const newCostPaisa = calculateWeightedAverageCost({
            currentQty: result.currentQty,
            currentCostPaisa: Number(result.product.cost_price),
            incomingQty: item.quantity,
            incomingCostPaisa: item.unitCostPaisa,
          });

          if (BigInt(newCostPaisa) !== result.product.cost_price) {
            await tx.product.update({
              where: { id: item.productId },
              data: { cost_price: BigInt(newCostPaisa) },
            });

            await tx.priceHistory.create({
              data: {
                tenant_id: tenantId,
                product_id: item.productId,
                old_cost_price: result.product.cost_price,
                new_cost_price: BigInt(newCostPaisa),
                old_selling_price: result.product.selling_price,
                new_selling_price: result.product.selling_price,
                change_reason: `Purchase receipt update: ${invoice.invoice_number}`,
                changed_by: userId,
              },
            });
          }
        }
      }

      // If status is RECEIVED, update supplier ledger and running balance
      if (dto.status === PurchaseInvoiceStatus.RECEIVED) {
        // Lock supplier row FOR UPDATE
        const [supplierRow] = await tx.$queryRaw<
          Array<{ id: string; current_balance_paisa: string }>
        >`
          SELECT id, current_balance_paisa
          FROM suppliers
          WHERE id = ${dto.supplierId}::uuid AND tenant_id = ${tenantId}::uuid
          FOR UPDATE
        `;

        const curBal = BigInt(supplierRow.current_balance_paisa);
        const balanceAfterInvoice = curBal + totalInvoicePaisa;

        // Append invoice entry to supplier ledger
        await tx.supplierLedger.create({
          data: {
            tenant_id: tenantId,
            supplier_id: dto.supplierId,
            type: SupplierLedgerEntryType.INVOICE,
            amount_paisa: totalInvoicePaisa,
            balance_after_paisa: balanceAfterInvoice,
            reference_type: 'PURCHASE_INVOICE',
            reference_id: invoice.id,
            notes: `Purchase invoice: ${invoice.invoice_number}`,
            created_by: userId,
          },
        });

        // If immediate payment was made at invoice creation
        if (paidAmountPaisa > 0n) {
          const paymentNumber = `PAY-${Date.now().toString(36).toUpperCase()}-${Math.floor(
            1000 + Math.random() * 9000,
          )}`;

          const payment = await tx.supplierPayment.create({
            data: {
              tenant_id: tenantId,
              supplier_id: dto.supplierId,
              payment_number: paymentNumber,
              amount_paisa: paidAmountPaisa,
              payment_method: dto.paymentMethod ?? 'CASH',
              payment_date: invoice.received_date ?? new Date(),
              reference_number: invoice.invoice_number,
              notes: `Immediate payment for invoice ${invoice.invoice_number}`,
              created_by: userId,
            },
          });

          const balanceAfterPayment = balanceAfterInvoice - paidAmountPaisa;

          await tx.supplierLedger.create({
            data: {
              tenant_id: tenantId,
              supplier_id: dto.supplierId,
              type: SupplierLedgerEntryType.PAYMENT,
              amount_paisa: -paidAmountPaisa,
              balance_after_paisa: balanceAfterPayment,
              reference_type: 'SUPPLIER_PAYMENT',
              reference_id: payment.id,
              notes: `Payment for invoice ${invoice.invoice_number}`,
              created_by: userId,
            },
          });

          await tx.supplier.update({
            where: { id: dto.supplierId },
            data: { current_balance_paisa: balanceAfterPayment },
          });
        } else {
          await tx.supplier.update({
            where: { id: dto.supplierId },
            data: { current_balance_paisa: balanceAfterInvoice },
          });
        }
      }

      return await tx.purchaseInvoice.findUnique({
        where: { id: invoice.id },
        include: {
          items: {
            include: { product: true },
          },
          supplier: true,
          branch: true,
        },
      });
    });
  }

  async listInvoices(tenantId: string, query: PurchaseInvoiceQueryInput) {
    const where: Prisma.PurchaseInvoiceWhereInput = {
      tenant_id: tenantId,
      ...(query.supplierId ? { supplier_id: query.supplierId } : {}),
      ...(query.branchId ? { branch_id: query.branchId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            invoice_number: { contains: query.search, mode: 'insensitive' },
          }
        : {}),
      ...(query.startDate || query.endDate
        ? {
            invoice_date: {
              ...(query.startDate ? { gte: query.startDate } : {}),
              ...(query.endDate ? { lte: query.endDate } : {}),
            },
          }
        : {}),
    };

    const [total, invoices] = await Promise.all([
      this.prisma.purchaseInvoice.count({ where }),
      this.prisma.purchaseInvoice.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true, phone: true } },
          branch: { select: { id: true, name: true, code: true } },
          items: true,
        },
        orderBy: { created_at: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      data: invoices,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        hasMore: query.page * query.limit < total,
      },
    };
  }

  async getInvoiceById(tenantId: string, invoiceId: string) {
    const invoice = await this.prisma.purchaseInvoice.findFirst({
      where: { id: invoiceId, tenant_id: tenantId },
      include: {
        supplier: true,
        branch: true,
        items: {
          include: { product: true },
        },
        returns: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Purchase invoice not found',
      });
    }

    return invoice;
  }

}
