import { z } from 'zod';
import { offsetPaginationSchema } from '../schemas/common.js';

export const PurchaseOrderStatus = {
  DRAFT: 'DRAFT',
  ORDERED: 'ORDERED',
  PARTIAL_RECEIVED: 'PARTIAL_RECEIVED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
} as const;
export type PurchaseOrderStatus = (typeof PurchaseOrderStatus)[keyof typeof PurchaseOrderStatus];

export const PurchaseInvoiceStatus = {
  PENDING: 'PENDING',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
} as const;
export type PurchaseInvoiceStatus = (typeof PurchaseInvoiceStatus)[keyof typeof PurchaseInvoiceStatus];

export const SupplierLedgerEntryType = {
  INVOICE: 'INVOICE',
  PAYMENT: 'PAYMENT',
  RETURN: 'RETURN',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;
export type SupplierLedgerEntryType = (typeof SupplierLedgerEntryType)[keyof typeof SupplierLedgerEntryType];

export const PurchaseReturnStatus = {
  DRAFT: 'DRAFT',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type PurchaseReturnStatus = (typeof PurchaseReturnStatus)[keyof typeof PurchaseReturnStatus];

export const PaymentMethod = {
  CASH: 'CASH',
  BANK_TRANSFER: 'BANK_TRANSFER',
  CHEQUE: 'CHEQUE',
  MOBILE_MONEY: 'MOBILE_MONEY',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

// ================= SUPPLIERS =================

export const createSupplierSchema = z.object({
  name: z.string().trim().min(1, 'Supplier name is required').max(128),
  contactPerson: z.string().trim().max(128).optional().nullable(),
  phone: z.string().trim().max(32).optional().nullable(),
  email: z.string().trim().email('Invalid email address').max(255).optional().nullable(),
  address: z.string().trim().optional().nullable(),
  openingBalancePaisa: z.coerce.number().int().default(0),
});
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = createSupplierSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

export const supplierQuerySchema = offsetPaginationSchema.extend({
  search: z.string().trim().optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
});
export type SupplierQueryInput = z.infer<typeof supplierQuerySchema>;

// ================= PURCHASE INVOICES =================

export const purchaseInvoiceItemSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  unitCostPaisa: z.coerce.number().int().nonnegative('Unit cost must be non-negative'),
});
export type PurchaseInvoiceItemInput = z.infer<typeof purchaseInvoiceItemSchema>;

export const createPurchaseInvoiceSchema = z.object({
  supplierId: z.string().uuid('Invalid supplier ID'),
  branchId: z.string().uuid('Invalid branch ID'),
  poId: z.string().uuid('Invalid purchase order ID').optional().nullable(),
  invoiceNumber: z.string().trim().min(1, 'Invoice number is required').max(64),
  invoiceDate: z.coerce.date().optional(),
  receivedDate: z.coerce.date().optional(),
  discountPaisa: z.coerce.number().int().nonnegative().default(0),
  taxPaisa: z.coerce.number().int().nonnegative().default(0),
  shippingCostPaisa: z.coerce.number().int().nonnegative().default(0),
  paidAmountPaisa: z.coerce.number().int().nonnegative().default(0),
  paymentMethod: z.string().trim().max(32).optional(),
  status: z.nativeEnum(PurchaseInvoiceStatus).default(PurchaseInvoiceStatus.RECEIVED),
  notes: z.string().trim().optional().nullable(),
  items: z.array(purchaseInvoiceItemSchema).min(1, 'Invoice must have at least one item'),
});
export type CreatePurchaseInvoiceInput = z.infer<typeof createPurchaseInvoiceSchema>;

export const purchaseInvoiceQuerySchema = offsetPaginationSchema.extend({
  supplierId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  status: z.nativeEnum(PurchaseInvoiceStatus).optional(),
  search: z.string().trim().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});
export type PurchaseInvoiceQueryInput = z.infer<typeof purchaseInvoiceQuerySchema>;

// ================= SUPPLIER PAYMENTS =================

export const createSupplierPaymentSchema = z.object({
  supplierId: z.string().uuid('Invalid supplier ID'),
  paymentNumber: z.string().trim().max(64).optional(),
  amountPaisa: z.coerce.number().int().positive('Payment amount must be greater than 0'),
  paymentMethod: z.string().trim().min(1, 'Payment method is required').max(32),
  paymentDate: z.coerce.date().optional(),
  referenceNumber: z.string().trim().max(128).optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});
export type CreateSupplierPaymentInput = z.infer<typeof createSupplierPaymentSchema>;

export const supplierPaymentQuerySchema = offsetPaginationSchema.extend({
  supplierId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});
export type SupplierPaymentQueryInput = z.infer<typeof supplierPaymentQuerySchema>;

// ================= PURCHASE RETURNS =================

export const purchaseReturnItemSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  unitCostPaisa: z.coerce.number().int().nonnegative('Unit cost must be non-negative'),
});
export type PurchaseReturnItemInput = z.infer<typeof purchaseReturnItemSchema>;

export const createPurchaseReturnSchema = z.object({
  supplierId: z.string().uuid('Invalid supplier ID'),
  branchId: z.string().uuid('Invalid branch ID'),
  purchaseInvoiceId: z.string().uuid().optional().nullable(),
  returnNumber: z.string().trim().max(64).optional(),
  returnDate: z.coerce.date().optional(),
  reason: z.string().trim().max(255).optional().nullable(),
  items: z.array(purchaseReturnItemSchema).min(1, 'Return must have at least one item'),
});
export type CreatePurchaseReturnInput = z.infer<typeof createPurchaseReturnSchema>;

export const purchaseReturnQuerySchema = offsetPaginationSchema.extend({
  supplierId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  purchaseInvoiceId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});
export type PurchaseReturnQueryInput = z.infer<typeof purchaseReturnQuerySchema>;

// ================= SUPPLIER LEDGER =================

export const supplierLedgerQuerySchema = offsetPaginationSchema.extend({
  supplierId: z.string().uuid().optional(),
  type: z.nativeEnum(SupplierLedgerEntryType).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});
export type SupplierLedgerQueryInput = z.infer<typeof supplierLedgerQuerySchema>;

// ================= CALCULATIONS & HELPERS =================

export interface InvoiceCalculationInput {
  items: Array<{
    quantity: number;
    unitCostPaisa: number;
  }>;
  discountPaisa?: number;
  taxPaisa?: number;
  shippingCostPaisa?: number;
}

export interface InvoiceCalculationResult {
  itemsSubtotalPaisa: number;
  totalPaisa: number;
  lineTotals: number[];
}

/**
 * Calculates subtotal, line totals, and net total for a purchase invoice in integer paisa.
 */
export function calculatePurchaseInvoiceTotals(
  input: InvoiceCalculationInput,
): InvoiceCalculationResult {
  const lineTotals = input.items.map((item) => Math.round(item.quantity * item.unitCostPaisa));
  const itemsSubtotalPaisa = lineTotals.reduce((sum, val) => sum + val, 0);

  const discountPaisa = input.discountPaisa ?? 0;
  const taxPaisa = input.taxPaisa ?? 0;
  const shippingCostPaisa = input.shippingCostPaisa ?? 0;

  const totalPaisa = Math.max(0, itemsSubtotalPaisa - discountPaisa + taxPaisa + shippingCostPaisa);

  return {
    itemsSubtotalPaisa,
    totalPaisa,
    lineTotals,
  };
}

/**
 * Calculates return subtotal in integer paisa.
 */
export function calculatePurchaseReturnTotals(
  items: Array<{ quantity: number; unitCostPaisa: number }>,
): number {
  return items.reduce((sum, item) => sum + Math.round(item.quantity * item.unitCostPaisa), 0);
}
