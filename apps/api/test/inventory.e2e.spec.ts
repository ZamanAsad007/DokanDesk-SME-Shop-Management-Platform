import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor.js';
import {
  setupTenantIsolationHarness,
  TenantIsolationHarness,
} from './harness/tenant-isolation.harness.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { ApiErrorCode } from '@dokandesk/shared';

describe('Inventory Ledger & Concurrency Tests (e2e)', () => {
  let app: INestApplication;
  let harness: TenantIsolationHarness;
  let prisma: PrismaService;

  let unitPcsId: string;
  let alphaProductId: string;
  let alphaBranch2Id: string;
  let betaProductId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ||
      'postgresql://dokandesk_user:e2260c5397b9d5a33fdb9752@localhost:5432/dokandesk_dev?schema=public';
    process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
    process.env.JWT_ACCESS_SECRET =
      process.env.JWT_ACCESS_SECRET || 'test_access_secret_min_32_characters_long_for_test';
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_min_32_characters_long_for_test';
    process.env.WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:5173';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    app.setGlobalPrefix('api/v1', {
      exclude: ['health', 'ready', 'docs', 'api/docs'],
    });

    await app.init();
    prisma = app.get(PrismaService);
    harness = await setupTenantIsolationHarness(app, `inv-${Date.now()}`);

    // Create unit for products
    const unitRes = await request(app.getHttpServer())
      .post('/api/v1/catalog/units')
      .set(harness.alpha.authHeaders)
      .send({ name: 'Pieces', code: `pcs-${Date.now()}` });
    unitPcsId = unitRes.body.data.id;

    // Create a product for Tenant Alpha
    const p1 = await request(app.getHttpServer())
      .post('/api/v1/catalog/products')
      .set(harness.alpha.authHeaders)
      .send({
        name: 'Alpha Basmati Rice 5kg',
        sku: `RICE-5KG-${Date.now()}`,
        unitId: unitPcsId,
        costPricePaisa: 4000,
        sellingPricePaisa: 5500,
        reorderLevel: 10,
      });
    expect(p1.status).toBe(201);
    alphaProductId = p1.body.data.id;

    // Create a second branch for Tenant Alpha (for transfer testing)
    const b2 = await request(app.getHttpServer())
      .post('/api/v1/branches')
      .set(harness.alpha.authHeaders)
      .send({
        name: 'Dhanmondi Branch',
        code: `DHM-${Date.now().toString().slice(-4)}`,
        address: 'Road 27, Dhanmondi',
      });
    expect(b2.status).toBe(201);
    alphaBranch2Id = b2.body.data.id;

    // Create a unit & product for Tenant Beta
    const betaUnitRes = await request(app.getHttpServer())
      .post('/api/v1/catalog/units')
      .set(harness.beta.authHeaders)
      .send({ name: 'Boxes', code: `box-${Date.now()}` });
    const betaUnitId = betaUnitRes.body.data.id;

    const pBeta = await request(app.getHttpServer())
      .post('/api/v1/catalog/products')
      .set(harness.beta.authHeaders)
      .send({
        name: 'Beta Sunflower Oil',
        sku: `OIL-1L-${Date.now()}`,
        unitId: betaUnitId,
        costPricePaisa: 8000,
        sellingPricePaisa: 9500,
      });
    expect(pBeta.status).toBe(201);
    betaProductId = pBeta.body.data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ================= 1. OPENING STOCK & WEIGHTED-AVERAGE COST =================

  it('records opening stock and recalculates weighted average cost', async () => {
    // 10 units @ 5000 paisa (50 BDT)
    const res = await request(app.getHttpServer())
      .post('/api/v1/inventory/opening')
      .set(harness.alpha.authHeaders)
      .send({
        branchId: harness.alpha.branchId,
        productId: alphaProductId,
        quantity: 10,
        unitCostPaisa: 5000,
        notes: 'Initial inventory intake',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(Number(res.body.data.stockLevel.current_quantity)).toBe(10);
    expect(res.body.data.updatedCostPricePaisa).toBe(5000);

    // Record second batch: 10 units @ 7000 paisa (70 BDT)
    // Avg = (10 * 5000 + 10 * 7000) / 20 = 6000 paisa
    const res2 = await request(app.getHttpServer())
      .post('/api/v1/inventory/opening')
      .set(harness.alpha.authHeaders)
      .send({
        branchId: harness.alpha.branchId,
        productId: alphaProductId,
        quantity: 10,
        unitCostPaisa: 7000,
      });

    expect(res2.status).toBe(201);
    expect(Number(res2.body.data.stockLevel.current_quantity)).toBe(20);
    expect(res2.body.data.updatedCostPricePaisa).toBe(6000);

    // Verify product table cost_price was updated
    const prod = await prisma.product.findUnique({
      where: { id: alphaProductId },
    });
    expect(Number(prod?.cost_price)).toBe(6000);
  });

  // ================= 2. ADJUSTMENTS & DAMAGE =================

  it('records adjustment with reason and approved status', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/inventory/adjustments')
      .set(harness.alpha.authHeaders)
      .send({
        branchId: harness.alpha.branchId,
        productId: alphaProductId,
        quantityDelta: -5,
        reason: 'Audit physical count difference',
        notes: 'Audited by store manager',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.adjustment.reason).toBe('Audit physical count difference');
    expect(res.body.data.adjustment.status).toBe('APPROVED');
    expect(Number(res.body.data.stockLevel.current_quantity)).toBe(15);
  });

  it('records damage movement and deducts stock', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/inventory/damage')
      .set(harness.alpha.authHeaders)
      .send({
        branchId: harness.alpha.branchId,
        productId: alphaProductId,
        quantity: 2,
        reason: 'Water leak damaged packaging',
      });

    expect(res.status).toBe(201);
    expect(Number(res.body.data.stockLevel.current_quantity)).toBe(13);
  });

  // ================= 3. INVARIANTS: LEVEL = SUM OF MOVEMENTS =================

  it('enforces invariant: stock level equals sum of all movements', async () => {
    // Current stock is 13 (10 + 10 - 5 - 2 = 13)
    const levelRes = await request(app.getHttpServer())
      .get(`/api/v1/inventory/levels/${harness.alpha.branchId}/${alphaProductId}`)
      .set(harness.alpha.authHeaders);

    expect(levelRes.status).toBe(200);
    const cachedQty = Number(levelRes.body.data.current_quantity);

    // Compute sum of movements directly from DB
    const movements = await prisma.stockMovement.findMany({
      where: {
        tenant_id: harness.alpha.tenantId,
        branch_id: harness.alpha.branchId,
        product_id: alphaProductId,
      },
    });

    const sumMovements = movements.reduce((acc, m) => acc + Number(m.quantity), 0);

    expect(cachedQty).toBe(13);
    expect(sumMovements).toBe(13);
    expect(cachedQty).toBe(sumMovements);
  });

  // ================= 4. INVARIANTS: NEGATIVE STOCK RULE =================

  it('rejects movements that cause negative stock when allow_negative_stock is false', async () => {
    // Current stock is 13. Attempting to deduct 14 must be rejected
    const res = await request(app.getHttpServer())
      .post('/api/v1/inventory/adjustments')
      .set(harness.alpha.authHeaders)
      .send({
        branchId: harness.alpha.branchId,
        productId: alphaProductId,
        quantityDelta: -14,
        reason: 'Oversold attempt',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ApiErrorCode.NEGATIVE_STOCK_NOT_ALLOWED);

    // Verify stock remains untouched at 13
    const levelRes = await request(app.getHttpServer())
      .get(`/api/v1/inventory/levels/${harness.alpha.branchId}/${alphaProductId}`)
      .set(harness.alpha.authHeaders);
    expect(Number(levelRes.body.data.current_quantity)).toBe(13);
  });

  it('permits negative stock when allow_negative_stock is true', async () => {
    // Enable allow_negative_stock for tenant Alpha
    await prisma.tenant.update({
      where: { id: harness.alpha.tenantId },
      data: { allow_negative_stock: true },
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/inventory/adjustments')
      .set(harness.alpha.authHeaders)
      .send({
        branchId: harness.alpha.branchId,
        productId: alphaProductId,
        quantityDelta: -15, // 13 - 15 = -2
        reason: 'Backorder fulfillment',
      });

    expect(res.status).toBe(201);
    expect(Number(res.body.data.stockLevel.current_quantity)).toBe(-2);

    // Revert back to false and bring stock back up
    await prisma.tenant.update({
      where: { id: harness.alpha.tenantId },
      data: { allow_negative_stock: false },
    });

    // Bring stock back to 50 for concurrency testing
    await request(app.getHttpServer())
      .post('/api/v1/inventory/opening')
      .set(harness.alpha.authHeaders)
      .send({
        branchId: harness.alpha.branchId,
        productId: alphaProductId,
        quantity: 52, // -2 + 52 = 50
        unitCostPaisa: 6000,
      });
  });

  // ================= 5. APPEND-ONLY TRIGGER TEST =================

  it('triggers PostgreSQL error when trying to UPDATE or DELETE stock_movements', async () => {
    const movement = await prisma.stockMovement.findFirst({
      where: { tenant_id: harness.alpha.tenantId },
    });
    expect(movement).toBeDefined();

    // Direct UPDATE attempt must fail via Postgres trigger
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE stock_movements SET quantity = 9999 WHERE id = '${movement?.id}'::uuid`,
      ),
    ).rejects.toThrow(/stock_movements is append-only/);

    // Direct DELETE attempt must fail via Postgres trigger
    await expect(
      prisma.$executeRawUnsafe(`DELETE FROM stock_movements WHERE id = '${movement?.id}'::uuid`),
    ).rejects.toThrow(/stock_movements is append-only/);
  });

  // ================= 6. CONCURRENCY: PARALLEL ADJUSTMENTS =================

  it('maintains strict invariant under concurrent parallel adjustments', async () => {
    // Current stock is 50.
    // Run 10 parallel operations simultaneously:
    // 5 operations adding +2 units each (+10 total)
    // 5 operations deducting -1 unit each (-5 total)
    // Net change: +5 units -> Expected final: 55 units
    const ops = [
      ...Array.from({ length: 5 }, () =>
        request(app.getHttpServer())
          .post('/api/v1/inventory/adjustments')
          .set(harness.alpha.authHeaders)
          .send({
            branchId: harness.alpha.branchId,
            productId: alphaProductId,
            quantityDelta: 2,
            reason: 'Concurrent addition',
          }),
      ),
      ...Array.from({ length: 5 }, () =>
        request(app.getHttpServer())
          .post('/api/v1/inventory/adjustments')
          .set(harness.alpha.authHeaders)
          .send({
            branchId: harness.alpha.branchId,
            productId: alphaProductId,
            quantityDelta: -1,
            reason: 'Concurrent deduction',
          }),
      ),
    ];

    const results = await Promise.all(ops);
    for (const res of results) {
      expect(res.status).toBe(201);
    }

    // Verify stock level matches exactly 55
    const levelRes = await request(app.getHttpServer())
      .get(`/api/v1/inventory/levels/${harness.alpha.branchId}/${alphaProductId}`)
      .set(harness.alpha.authHeaders);
    expect(Number(levelRes.body.data.current_quantity)).toBe(55);

    // Verify DB invariant: cached level == sum(all movements)
    const allMovements = await prisma.stockMovement.findMany({
      where: {
        tenant_id: harness.alpha.tenantId,
        branch_id: harness.alpha.branchId,
        product_id: alphaProductId,
      },
    });

    const sum = allMovements.reduce((acc, m) => acc + Number(m.quantity), 0);
    expect(sum).toBe(55);
  });

  // ================= 7. BRANCH TRANSFERS =================

  it('dispatches and receives stock transfer between branches', async () => {
    // Transfer 10 units from Alpha Branch 1 to Alpha Branch 2
    const transferRes = await request(app.getHttpServer())
      .post('/api/v1/inventory/transfers')
      .set(harness.alpha.authHeaders)
      .send({
        fromBranchId: harness.alpha.branchId,
        toBranchId: alphaBranch2Id,
        items: [{ productId: alphaProductId, quantity: 10 }],
        notes: 'Transfer to Dhanmondi branch',
      });

    expect(transferRes.status).toBe(201);
    expect(transferRes.body.data.status).toBe('DISPATCHED');
    const transferId = transferRes.body.data.id;

    // Source branch stock must have decreased from 55 to 45
    const srcLevel = await request(app.getHttpServer())
      .get(`/api/v1/inventory/levels/${harness.alpha.branchId}/${alphaProductId}`)
      .set(harness.alpha.authHeaders);
    expect(Number(srcLevel.body.data.current_quantity)).toBe(45);

    // Destination branch stock should still be 0 before receive
    const destLevelBefore = await request(app.getHttpServer())
      .get(`/api/v1/inventory/levels/${alphaBranch2Id}/${alphaProductId}`)
      .set(harness.alpha.authHeaders);
    expect(Number(destLevelBefore.body.data.current_quantity)).toBe(0);

    // Receive transfer
    const receiveRes = await request(app.getHttpServer())
      .post(`/api/v1/inventory/transfers/${transferId}/receive`)
      .set(harness.alpha.authHeaders);

    expect(receiveRes.status).toBe(201);
    expect(receiveRes.body.data.status).toBe('RECEIVED');

    // Destination branch stock should now be 10
    const destLevelAfter = await request(app.getHttpServer())
      .get(`/api/v1/inventory/levels/${alphaBranch2Id}/${alphaProductId}`)
      .set(harness.alpha.authHeaders);
    expect(Number(destLevelAfter.body.data.current_quantity)).toBe(10);
  });

  // ================= 8. LOW-STOCK ALERTS =================

  it('identifies products below reorder point in low-stock alerts', async () => {
    // Create a product with stock = 2 and reorder level = 10
    const pLow = await request(app.getHttpServer())
      .post('/api/v1/catalog/products')
      .set(harness.alpha.authHeaders)
      .send({
        name: 'Low Stock Item Sugar',
        sku: `SUGAR-${Date.now()}`,
        unitId: unitPcsId,
        costPricePaisa: 10000,
        sellingPricePaisa: 12000,
        reorderLevel: 10,
      });
    const lowProductId = pLow.body.data.id;

    await request(app.getHttpServer())
      .post('/api/v1/inventory/opening')
      .set(harness.alpha.authHeaders)
      .send({
        branchId: harness.alpha.branchId,
        productId: lowProductId,
        quantity: 2,
        unitCostPaisa: 10000,
      });

    const alertRes = await request(app.getHttpServer())
      .get('/api/v1/inventory/low-stock')
      .set(harness.alpha.authHeaders);

    expect(alertRes.status).toBe(200);
    const lowItems = alertRes.body.data.items;
    const found = lowItems.find((i: { product_id: string }) => i.product_id === lowProductId);
    expect(found).toBeDefined();
    expect(Number(found.current_quantity)).toBe(2);
    expect(Number(found.reorder_point)).toBe(10);
  });

  // ================= 9. CROSS-TENANT ISOLATION =================

  it('strictly isolates inventory across tenants', async () => {
    // Tenant Beta cannot adjust Tenant Alpha product
    const betaAdjustRes = await request(app.getHttpServer())
      .post('/api/v1/inventory/adjustments')
      .set(harness.beta.authHeaders)
      .send({
        branchId: harness.beta.branchId,
        productId: alphaProductId, // Belongs to Alpha!
        quantityDelta: 10,
        reason: 'Cross-tenant attack attempt',
      });
    expect(betaAdjustRes.status).toBe(404);

    // Tenant Beta querying levels returns only their own products
    const betaLevels = await request(app.getHttpServer())
      .get('/api/v1/inventory/levels')
      .set(harness.beta.authHeaders);
    expect(betaLevels.status).toBe(200);
    const items = betaLevels.body.data.items;
    const leak = items.find((i: { product_id: string }) => i.product_id === alphaProductId);
    expect(leak).toBeUndefined();

    // Tenant Alpha cannot adjust Tenant Beta product
    const alphaAdjustBeta = await request(app.getHttpServer())
      .post('/api/v1/inventory/adjustments')
      .set(harness.alpha.authHeaders)
      .send({
        branchId: harness.alpha.branchId,
        productId: betaProductId, // Belongs to Beta!
        quantityDelta: 10,
        reason: 'Cross-tenant attack attempt',
      });
    expect(alphaAdjustBeta.status).toBe(404);
  });
});
