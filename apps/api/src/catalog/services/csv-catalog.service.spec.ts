import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CsvCatalogService } from './csv-catalog.service.js';

describe('CsvCatalogService', () => {
  let csvService: CsvCatalogService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      unit: {
        findMany: vi.fn().mockResolvedValue([{ id: 'u-pcs', code: 'pcs' }]),
        create: vi.fn().mockResolvedValue({ id: 'u-kg', code: 'kg' }),
      },
      category: {
        findMany: vi.fn().mockResolvedValue([{ id: 'cat-bev', name: 'Beverages' }]),
        create: vi.fn().mockResolvedValue({ id: 'cat-snacks', name: 'Snacks' }),
      },
      brand: {
        findMany: vi.fn().mockResolvedValue([{ id: 'brand-coke', name: 'Coca-Cola' }]),
        create: vi.fn().mockResolvedValue({ id: 'brand-lays', name: 'Lays' }),
      },
      product: {
        upsert: vi.fn().mockResolvedValue({ id: 'prod-1' }),
        findMany: vi.fn(),
      },
      priceHistory: {
        create: vi.fn().mockResolvedValue({ id: 'ph-1' }),
      },
      $transaction: vi.fn(async (cb) => {
        if (typeof cb === 'function') {
          return cb(mockPrisma);
        }
        return Promise.all(cb);
      }),
    };

    csvService = new CsvCatalogService(mockPrisma);
  });

  describe('importProductsCsv', () => {
    it('imports valid CSV rows and converts decimal currency to integer paisa', async () => {
      const csv = `name,sku,barcode,unit_code,cost_price,selling_price,vat_rate,reorder_level,category_name,brand_name
Coca Cola 500ml,COKE-500,8941001,pcs,35.50,45.00,5,10,Beverages,Coca-Cola
Potato Chips 50g,CHIPS-50,8941002,pcs,15.00,20.00,0,5,Snacks,Lays`;

      const report = await csvService.importProductsCsv('tenant-1', 'user-1', csv);

      expect(report.totalRows).toBe(2);
      expect(report.importedCount).toBe(2);
      expect(report.failedCount).toBe(0);
      expect(report.errors).toHaveLength(0);

      expect(mockPrisma.product.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            sku: 'COKE-500',
            cost_price: 3550n,
            selling_price: 4500n,
          }),
        }),
      );
    });

    it('collects validation report errors for invalid rows without halting entire batch', async () => {
      const csv = `name,sku,barcode,unit_code,cost_price,selling_price,vat_rate,reorder_level,category_name,brand_name
Valid Product,VALID-1,,pcs,10.00,15.00,0,0,,
X,,8941002,pcs,-5.00,20.00,0,0,,`; // Row 3 has name too short, empty SKU, negative cost

      const report = await csvService.importProductsCsv('tenant-1', 'user-1', csv);

      expect(report.totalRows).toBe(2);
      expect(report.importedCount).toBe(1);
      expect(report.failedCount).toBe(1);
      expect(report.errors).toHaveLength(1);
      expect(report.errors[0].row).toBe(3);
    });
  });

  describe('exportProductsCsv', () => {
    it('exports products in standard CSV format', async () => {
      mockPrisma.product.findMany.mockResolvedValue([
        {
          name: 'Cola 500ml',
          sku: 'COLA-500',
          barcode: '8941001',
          cost_price: 3550n,
          selling_price: 4500n,
          vat_rate_percent: 5,
          reorder_level: 10,
          is_active: true,
          unit: { code: 'pcs' },
          category: { name: 'Beverages' },
          brand: { name: 'Coca-Cola' },
        },
      ]);

      const csv = await csvService.exportProductsCsv('tenant-1');
      expect(csv).toContain('name,sku,barcode,unit_code,cost_price,selling_price');
      expect(csv).toContain('"Cola 500ml","COLA-500","8941001","pcs",35.50,45.00,5.00,10.00');
    });
  });
});
