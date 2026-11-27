import { describe, it, expect } from 'vitest';
import {
  createSupplierSchema,
  createPurchaseInvoiceSchema,
  calculatePurchaseInvoiceTotals,
  calculatePurchaseReturnTotals,
  PurchaseInvoiceStatus,
} from './purchasing.js';

describe('Purchasing Schemas & Calculation Helpers', () => {
  describe('createSupplierSchema', () => {
    it('validates a valid supplier payload', () => {
      const parsed = createSupplierSchema.safeParse({
        name: 'Square Pharmaceuticals Ltd.',
        contactPerson: 'Md. Karim',
        phone: '+8801711000000',
        email: 'supply@square.com',
        address: 'Uttara, Dhaka',
        openingBalancePaisa: 500000,
      });

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.name).toBe('Square Pharmaceuticals Ltd.');
        expect(parsed.data.openingBalancePaisa).toBe(500000);
      }
    });

    it('rejects empty name or invalid email', () => {
      const parsed = createSupplierSchema.safeParse({
        name: '',
        email: 'invalid-email-address',
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe('createPurchaseInvoiceSchema', () => {
    it('validates a valid purchase invoice', () => {
      const parsed = createPurchaseInvoiceSchema.safeParse({
        supplierId: 'a0000000-0000-0000-0000-000000000001',
        branchId: 'b0000000-0000-0000-0000-000000000002',
        invoiceNumber: 'INV-2026-001',
        items: [
          {
            productId: 'c0000000-0000-0000-0000-000000000003',
            quantity: 50,
            unitCostPaisa: 4000,
          },
        ],
        discountPaisa: 1000,
        taxPaisa: 500,
        shippingCostPaisa: 200,
        paidAmountPaisa: 50000,
      });

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.status).toBe(PurchaseInvoiceStatus.RECEIVED);
        expect(parsed.data.items).toHaveLength(1);
      }
    });

    it('rejects empty items array', () => {
      const parsed = createPurchaseInvoiceSchema.safeParse({
        supplierId: 'a0000000-0000-0000-0000-000000000001',
        branchId: 'b0000000-0000-0000-0000-000000000002',
        invoiceNumber: 'INV-2026-001',
        items: [],
      });

      expect(parsed.success).toBe(false);
    });
  });

  describe('calculatePurchaseInvoiceTotals', () => {
    it('computes exact subtotal, net total, and line totals in integer paisa', () => {
      const result = calculatePurchaseInvoiceTotals({
        items: [
          { quantity: 10, unitCostPaisa: 2500 }, // 25,000
          { quantity: 5, unitCostPaisa: 4000 },  // 20,000
        ],
        discountPaisa: 5000,
        taxPaisa: 2250,
        shippingCostPaisa: 1000,
      });

      expect(result.lineTotals).toEqual([25000, 20000]);
      expect(result.itemsSubtotalPaisa).toBe(45000);
      // 45,000 - 5,000 + 2,250 + 1,000 = 43,250
      expect(result.totalPaisa).toBe(43250);
    });
  });

  describe('calculatePurchaseReturnTotals', () => {
    it('computes exact return total in integer paisa', () => {
      const total = calculatePurchaseReturnTotals([
        { quantity: 2, unitCostPaisa: 2500 }, // 5,000
        { quantity: 3, unitCostPaisa: 1000 }, // 3,000
      ]);

      expect(total).toBe(8000);
    });
  });
});
