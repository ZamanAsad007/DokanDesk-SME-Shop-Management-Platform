import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { z } from 'zod';

export interface CsvImportReport {
  totalRows: number;
  importedCount: number;
  failedCount: number;
  errors: Array<{
    row: number;
    sku?: string;
    message: string;
  }>;
}

const csvRowSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  sku: z.string().trim().toUpperCase().min(1, 'SKU is required'),
  barcode: z.string().trim().optional(),
  unit_code: z.string().trim().toLowerCase().min(1, 'Unit code is required'),
  cost_price: z.coerce.number().nonnegative('Cost price cannot be negative'),
  selling_price: z.coerce.number().nonnegative('Selling price cannot be negative'),
  vat_rate: z.coerce.number().min(0).max(100).default(0),
  reorder_level: z.coerce.number().nonnegative().default(0),
  category_name: z.string().trim().optional(),
  brand_name: z.string().trim().optional(),
});

@Injectable()
export class CsvCatalogService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Parses CSV string into rows (supporting basic quoted strings).
   */
  parseCsv(content: string): string[][] {
    const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
    return lines.map((line) => {
      const row: string[] = [];
      let inQuotes = false;
      let field = '';

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          row.push(field.trim());
          field = '';
        } else {
          field += char;
        }
      }
      row.push(field.trim());
      return row;
    });
  }

  /**
   * Imports products from a CSV string with a detailed validation report.
   */
  async importProductsCsv(
    tenantId: string,
    userId: string,
    csvContent: string,
  ): Promise<CsvImportReport> {
    const rows = this.parseCsv(csvContent);
    if (rows.length < 2) {
      return {
        totalRows: 0,
        importedCount: 0,
        failedCount: 0,
        errors: [{ row: 1, message: 'CSV file is empty or missing data rows' }],
      };
    }

    const headers = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, ''));
    const dataRows = rows.slice(1);

    const report: CsvImportReport = {
      totalRows: dataRows.length,
      importedCount: 0,
      failedCount: 0,
      errors: [],
    };

    // Preload tenant units, categories, and brands to minimize queries
    const [units, categories, brands] = await Promise.all([
      this.prisma.unit.findMany({ where: { tenant_id: tenantId } }),
      this.prisma.category.findMany({ where: { tenant_id: tenantId } }),
      this.prisma.brand.findMany({ where: { tenant_id: tenantId } }),
    ]);

    const unitMap = new Map(units.map((u) => [u.code.toLowerCase(), u.id]));
    const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
    const brandMap = new Map(brands.map((b) => [b.name.toLowerCase(), b.id]));

    for (let i = 0; i < dataRows.length; i++) {
      const rowNum = i + 2; // Row number 1-indexed including header
      const rowData: Record<string, string> = {};

      headers.forEach((header, idx) => {
        rowData[header] = dataRows[i][idx] ?? '';
      });

      const parseResult = csvRowSchema.safeParse(rowData);
      if (!parseResult.success) {
        const errMessage = parseResult.error.errors.map((e) => e.message).join('; ');
        report.errors.push({
          row: rowNum,
          sku: rowData['sku'],
          message: errMessage,
        });
        report.failedCount++;
        continue;
      }

      const item = parseResult.data;

      // Check unit
      let unitId = unitMap.get(item.unit_code);
      if (!unitId) {
        // Create unit on the fly if it doesn't exist
        const newUnit = await this.prisma.unit.create({
          data: {
            tenant_id: tenantId,
            name: item.unit_code.toUpperCase(),
            code: item.unit_code,
          },
        });
        unitId = newUnit.id;
        unitMap.set(item.unit_code, unitId);
      }

      // Check category
      let categoryId: string | undefined;
      if (item.category_name) {
        const catKey = item.category_name.toLowerCase();
        if (categoryMap.has(catKey)) {
          categoryId = categoryMap.get(catKey);
        } else {
          const newCat = await this.prisma.category.create({
            data: {
              tenant_id: tenantId,
              name: item.category_name,
            },
          });
          categoryId = newCat.id;
          categoryMap.set(catKey, categoryId);
        }
      }

      // Check brand
      let brandId: string | undefined;
      if (item.brand_name) {
        const brandKey = item.brand_name.toLowerCase();
        if (brandMap.has(brandKey)) {
          brandId = brandMap.get(brandKey);
        } else {
          const newBrand = await this.prisma.brand.create({
            data: {
              tenant_id: tenantId,
              name: item.brand_name,
            },
          });
          brandId = newBrand.id;
          brandMap.set(brandKey, brandId);
        }
      }

      // Convert cost and selling price to integer paisa
      const costPricePaisa = BigInt(Math.round(item.cost_price * 100));
      const sellingPricePaisa = BigInt(Math.round(item.selling_price * 100));

      try {
        await this.prisma.$transaction(async (tx) => {
          const product = await tx.product.upsert({
            where: {
              tenant_id_sku: {
                tenant_id: tenantId,
                sku: item.sku,
              },
            },
            create: {
              tenant_id: tenantId,
              name: item.name,
              sku: item.sku,
              barcode: item.barcode || null,
              unit_id: unitId!,
              category_id: categoryId || null,
              brand_id: brandId || null,
              cost_price: costPricePaisa,
              selling_price: sellingPricePaisa,
              vat_rate_percent: item.vat_rate,
              reorder_level: item.reorder_level,
            },
            update: {
              name: item.name,
              barcode: item.barcode || null,
              unit_id: unitId!,
              category_id: categoryId || null,
              brand_id: brandId || null,
              cost_price: costPricePaisa,
              selling_price: sellingPricePaisa,
              vat_rate_percent: item.vat_rate,
              reorder_level: item.reorder_level,
            },
          });

          await tx.priceHistory.create({
            data: {
              tenant_id: tenantId,
              product_id: product.id,
              old_cost_price: costPricePaisa,
              new_cost_price: costPricePaisa,
              old_selling_price: sellingPricePaisa,
              new_selling_price: sellingPricePaisa,
              change_reason: 'CSV Import',
              changed_by: userId,
            },
          });
        });

        report.importedCount++;
      } catch (err: any) {
        report.failedCount++;
        report.errors.push({
          row: rowNum,
          sku: item.sku,
          message: err.message || 'Database error during insertion',
        });
      }
    }

    return report;
  }

  /**
   * Generates a CSV export of all products in the tenant.
   */
  async exportProductsCsv(tenantId: string): Promise<string> {
    const products = await this.prisma.product.findMany({
      where: { tenant_id: tenantId },
      include: {
        category: true,
        brand: true,
        unit: true,
      },
      orderBy: { name: 'asc' },
    });

    const headers = [
      'name',
      'sku',
      'barcode',
      'unit_code',
      'cost_price',
      'selling_price',
      'vat_rate',
      'reorder_level',
      'category_name',
      'brand_name',
      'is_active',
    ];

    const lines = [headers.join(',')];

    for (const p of products) {
      const costDecimal = (Number(p.cost_price) / 100).toFixed(2);
      const sellDecimal = (Number(p.selling_price) / 100).toFixed(2);

      const row = [
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.sku}"`,
        `"${p.barcode || ''}"`,
        `"${p.unit.code}"`,
        costDecimal,
        sellDecimal,
        Number(p.vat_rate_percent).toFixed(2),
        Number(p.reorder_level).toFixed(2),
        `"${p.category?.name || ''}"`,
        `"${p.brand?.name || ''}"`,
        p.is_active ? 'true' : 'false',
      ];

      lines.push(row.join(','));
    }

    return lines.join('\n');
  }
}
