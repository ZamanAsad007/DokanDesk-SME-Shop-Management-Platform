import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CatalogService } from './catalog.service.js';
import { ConflictException } from '@nestjs/common';

describe('CatalogService', () => {
  let catalogService: CatalogService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      category: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      brand: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      unit: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      unitConversion: {
        upsert: vi.fn(),
      },
      product: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      productVariant: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      priceHistory: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => {
        if (typeof cb === 'function') {
          return cb(mockPrisma);
        }
        return Promise.all(cb);
      }),
    };

    catalogService = new CatalogService(mockPrisma);
  });

  describe('Categories', () => {
    it('creates a category when valid', async () => {
      mockPrisma.category.findFirst.mockResolvedValue(null);
      mockPrisma.category.create.mockResolvedValue({
        id: 'cat-1',
        tenant_id: 't-1',
        name: 'Beverages',
        parent_id: null,
      });

      const result = await catalogService.createCategory('t-1', 'u-1', {
        name: 'Beverages',
      });

      expect(result.name).toBe('Beverages');
      expect(mockPrisma.category.create).toHaveBeenCalled();
    });

    it('throws ConflictException if category name exists in same parent', async () => {
      mockPrisma.category.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        catalogService.createCategory('t-1', 'u-1', { name: 'Beverages' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Products & Search', () => {
    it('creates product and initializes price history record with integer paisa', async () => {
      mockPrisma.product.findFirst
        .mockResolvedValueOnce(null) // SKU check
        .mockResolvedValueOnce({
          id: 'prod-1',
          name: 'Cola Can 250ml',
          sku: 'COLA-250',
          barcode: '89411001',
          cost_price: 2500n, // 25.00 BDT
          selling_price: 3500n, // 35.00 BDT
          mrp: 3500n,
          vat_rate_percent: 5,
          reorder_level: 10,
          is_active: true,
          unit: { id: 'u-1', name: 'Piece', code: 'pcs' },
          variants: [],
          price_history: [],
        });

      mockPrisma.unit.findFirst.mockResolvedValue({ id: 'u-1', code: 'pcs' });
      mockPrisma.product.create.mockResolvedValue({
        id: 'prod-1',
        name: 'Cola Can 250ml',
        sku: 'COLA-250',
      });

      const result = await catalogService.createProduct('t-1', 'u-1', {
        name: 'Cola Can 250ml',
        sku: 'COLA-250',
        barcode: '89411001',
        unitId: 'u-1',
        costPricePaisa: 2500,
        sellingPricePaisa: 3500,
      });

      expect(result.sku).toBe('COLA-250');
      expect(result.costPricePaisa).toBe(2500);
      expect(result.sellingPricePaisa).toBe(3500);
      expect(mockPrisma.priceHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            old_cost_price: 2500n,
            new_cost_price: 2500n,
            old_selling_price: 3500n,
            new_selling_price: 3500n,
          }),
        }),
      );
    });

    it('searches products with case-insensitive name, SKU, or barcode', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          name: 'Orange Juice 1L',
          sku: 'JUICE-ORG-1L',
          barcode: '77889900',
          cost_price: 8000n,
          selling_price: 11000n,
          vat_rate_percent: 0,
          reorder_level: 5,
          unit: { id: 'u-1', name: 'Piece', code: 'pcs' },
          variants: [],
        },
      ]);
      mockPrisma.product.count.mockResolvedValue(1);

      const result = await catalogService.listProducts('t-1', {
        search: 'juice',
        page: 1,
        limit: 20,
      });

      expect(result.products.length).toBe(1);
      expect(result.products[0].name).toBe('Orange Juice 1L');
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'juice', mode: 'insensitive' } },
              { sku: { contains: 'juice', mode: 'insensitive' } },
              { barcode: { contains: 'juice', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('tracks price history on product price update', async () => {
      mockPrisma.product.findFirst
        .mockResolvedValueOnce({
          id: 'prod-1',
          tenant_id: 't-1',
          sku: 'COLA-250',
          cost_price: 2500n,
          selling_price: 3500n,
        })
        .mockResolvedValueOnce({
          id: 'prod-1',
          name: 'Cola Can 250ml',
          sku: 'COLA-250',
          cost_price: 2700n,
          selling_price: 4000n,
          vat_rate_percent: 0,
          reorder_level: 0,
          unit: { id: 'u-1', name: 'Piece', code: 'pcs' },
          variants: [],
          price_history: [],
        });

      mockPrisma.product.update.mockResolvedValue({
        id: 'prod-1',
        cost_price: 2700n,
        selling_price: 4000n,
      });

      await catalogService.updateProduct('t-1', 'u-1', 'prod-1', {
        costPricePaisa: 2700,
        sellingPricePaisa: 4000,
        priceChangeReason: 'Supplier cost increase',
      });

      expect(mockPrisma.priceHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            old_cost_price: 2500n,
            new_cost_price: 2700n,
            old_selling_price: 3500n,
            new_selling_price: 4000n,
            change_reason: 'Supplier cost increase',
          }),
        }),
      );
    });
  });
});
