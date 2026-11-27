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
import { Role } from '@dokandesk/shared';

describe('Purchasing Module & Supplier Ledger (e2e)', () => {
  let app: INestApplication;
  let harness: TenantIsolationHarness;
  let prisma: PrismaService;

  let unitPcsId: string;
  let alphaProductId: string;
  let alphaProduct2Id: string;
  let storekeeperToken: string;
  let cashierToken: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ||
      'postgresql://dokandesk_user:e2260c5397b9d5a33fdb9752@localhost:5433/dokandesk_dev?schema=public';
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
    harness = await setupTenantIsolationHarness(app, `pur-${Date.now()}`);

    // Create a shared unit
    const unitRes = await request(app.getHttpServer())
      .post('/api/v1/catalog/units')
      .set(harness.alpha.authHeaders)
      .send({ name: 'Pieces', code: `pcs-${Date.now()}` });
    unitPcsId = unitRes.body.data.id;

    // Create 2 products for Tenant Alpha
    const p1 = await request(app.getHttpServer())
      .post('/api/v1/catalog/products')
      .set(harness.alpha.authHeaders)
      .send({
        name: 'Aci Pure Salt 1kg',
        sku: `SALT-1KG-${Date.now()}`,
        unitId: unitPcsId,
        costPricePaisa: 3500, // 35 BDT
        sellingPricePaisa: 4200, // 42 BDT
        reorderLevel: 20,
      });
    expect(p1.status).toBe(201);
    alphaProductId = p1.body.data.id;

    const p2 = await request(app.getHttpServer())
      .post('/api/v1/catalog/products')
      .set(harness.alpha.authHeaders)
      .send({
        name: 'Teer Soybean Oil 5L',
        sku: `OIL-5L-${Date.now()}`,
        unitId: unitPcsId,
        costPricePaisa: 80000, // 800 BDT
        sellingPricePaisa: 92000,
        reorderLevel: 5,
      });
    expect(p2.status).toBe(201);
    alphaProduct2Id = p2.body.data.id;

    // Create a product for Tenant Beta
    const betaUnitRes = await request(app.getHttpServer())
      .post('/api/v1/catalog/units')
      .set(harness.beta.authHeaders)
      .send({ name: 'Beta Pcs', code: `bpcs-${Date.now()}` });
    const betaUnitId = betaUnitRes.body.data.id;

    await request(app.getHttpServer())
      .post('/api/v1/catalog/products')
      .set(harness.beta.authHeaders)
      .send({
        name: 'Beta Parachute Coconut Oil',
        sku: `PARA-COCO-${Date.now()}`,
        unitId: betaUnitId,
        costPricePaisa: 15000,
        sellingPricePaisa: 18000,
      });

    // Create a Storekeeper user for Tenant Alpha
    const skUserRes = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set(harness.alpha.authHeaders)
      .send({
        name: 'Storekeeper User',
        email: `sk-${Date.now()}@alpha.com`,
        password: 'PasswordStore123!',
        role: Role.STOREKEEPER,
      });
    expect(skUserRes.status).toBe(201);

    const skLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        tenantSlug: harness.alpha.tenantSlug,
        email: skUserRes.body.data.email,
        password: 'PasswordStore123!',
      });
    expect(skLogin.status).toBe(200);
    storekeeperToken = `Bearer ${skLogin.body.data.tokens.accessToken}`;

    // Create a Cashier user for Tenant Alpha
    const cashierUserRes = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set(harness.alpha.authHeaders)
      .send({
        name: 'Cashier User',
        email: `cashier-${Date.now()}@alpha.com`,
        password: 'PasswordCashier123!',
        role: Role.CASHIER,
      });
    expect(cashierUserRes.status).toBe(201);

    const cashierLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        tenantSlug: harness.alpha.tenantSlug,
        email: cashierUserRes.body.data.email,
        password: 'PasswordCashier123!',
      });
    expect(cashierLogin.status).toBe(200);
    cashierToken = `Bearer ${cashierLogin.body.data.tokens.accessToken}`;
  });

  afterAll(async () => {
    await app.close();
  });

  // ================= 1. SUPPLIERS CRUD =================

  let alphaSupplier1Id: string;
  let alphaSupplier2Id: string;
  let betaSupplierId: string;

  it('creates suppliers with opening balance and writes to supplier_ledger', async () => {
    // Supplier 1: Opening balance 50,000 paisa (500 BDT)
    const res = await request(app.getHttpServer())
      .post('/api/v1/purchasing/suppliers')
      .set(harness.alpha.authHeaders)
      .send({
        name: 'ACI Consumer Brands',
        contactPerson: 'Rahim Ahmed',
        phone: '+8801700000001',
        email: 'rahim@aci.fake',
        address: 'Tejgaon, Dhaka',
        openingBalancePaisa: 50000,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('ACI Consumer Brands');
    expect(Number(res.body.data.opening_balance_paisa)).toBe(50000);
    expect(Number(res.body.data.current_balance_paisa)).toBe(50000);
    alphaSupplier1Id = res.body.data.id;

    // Verify initial opening balance ledger entry was recorded
    const ledger = await request(app.getHttpServer())
      .get(`/api/v1/purchasing/suppliers/${alphaSupplier1Id}/ledger`)
      .set(harness.alpha.authHeaders);

    expect(ledger.status).toBe(200);
    expect(ledger.body.data).toHaveLength(1);
    expect(ledger.body.data[0].type).toBe('ADJUSTMENT');
    expect(Number(ledger.body.data[0].amount_paisa)).toBe(50000);
    expect(Number(ledger.body.data[0].balance_after_paisa)).toBe(50000);

    // Supplier 2: No opening balance (0)
    const res2 = await request(app.getHttpServer())
      .post('/api/v1/purchasing/suppliers')
      .set(harness.alpha.authHeaders)
      .send({
        name: 'City Group (Teer)',
        contactPerson: 'Karim Ullah',
        phone: '+8801700000002',
      });

    expect(res2.status).toBe(201);
    expect(Number(res2.body.data.opening_balance_paisa)).toBe(0);
    expect(Number(res2.body.data.current_balance_paisa)).toBe(0);
    alphaSupplier2Id = res2.body.data.id;

    // Supplier for Tenant Beta
    const resBeta = await request(app.getHttpServer())
      .post('/api/v1/purchasing/suppliers')
      .set(harness.beta.authHeaders)
      .send({
        name: 'Marico Bangladesh Ltd.',
        phone: '+8801700000003',
        openingBalancePaisa: 100000,
      });

    expect(resBeta.status).toBe(201);
    betaSupplierId = resBeta.body.data.id;
  });

  it('rejects duplicate supplier name within the same tenant', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/purchasing/suppliers')
      .set(harness.alpha.authHeaders)
      .send({
        name: 'ACI Consumer Brands',
      });

    expect(res.status).toBe(409);
  });

  it('lists and updates suppliers', async () => {
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/purchasing/suppliers?search=ACI')
      .set(harness.alpha.authHeaders);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].id).toBe(alphaSupplier1Id);

    const updateRes = await request(app.getHttpServer())
      .put(`/api/v1/purchasing/suppliers/${alphaSupplier1Id}`)
      .set(harness.alpha.authHeaders)
      .send({
        contactPerson: 'Rahim Ahmed (Updated)',
        phone: '+8801799999999',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.contact_person).toBe('Rahim Ahmed (Updated)');
    expect(updateRes.body.data.phone).toBe('+8801799999999');
  });

  // ================= 2. PURCHASE INVOICES (GOODS RECEIPT) =================

  let alphaInvoice1Id: string;

  it('creates purchase invoice, generates stock movements, updates weighted average cost, and writes supplier ledger', async () => {
    // Product 1: currently 0 stock, cost 3500 paisa.
    // Receive 100 units of Aci Pure Salt @ 4000 paisa (40 BDT) each = 400,000 paisa.
    // Discount: 10,000 paisa; Tax: 5,000 paisa; Shipping: 2,000 paisa.
    // Net total = 400,000 - 10,000 + 5,000 + 2,000 = 397,000 paisa (3,970 BDT).
    // Initial supplier balance was 50,000 paisa.
    // New supplier balance after invoice = 50,000 + 397,000 = 447,000 paisa.

    const invoiceNumber = `INV-${Date.now()}`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/purchasing/invoices')
      .set(harness.alpha.authHeaders)
      .send({
        supplierId: alphaSupplier1Id,
        branchId: harness.alpha.branchId,
        invoiceNumber,
        items: [
          {
            productId: alphaProductId,
            quantity: 100,
            unitCostPaisa: 4000,
          },
        ],
        discountPaisa: 10000,
        taxPaisa: 5000,
        shippingCostPaisa: 2000,
        paidAmountPaisa: 0,
        notes: 'Challan #4489 Received by Store',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    alphaInvoice1Id = res.body.data.id;
    expect(Number(res.body.data.total_paisa)).toBe(397000);
    expect(res.body.data.items).toHaveLength(1);

    // 1. Verify append-only stock movement was created
    const movements = await prisma.stockMovement.findMany({
      where: {
        tenant_id: harness.alpha.tenantId,
        product_id: alphaProductId,
        reference_id: alphaInvoice1Id,
      },
    });
    expect(movements).toHaveLength(1);
    expect(movements[0].type).toBe('PURCHASE');
    expect(Number(movements[0].quantity)).toBe(100);
    expect(Number(movements[0].unit_cost_paisa)).toBe(4000);

    // 2. Verify stock level was updated to 100
    const stockLevel = await prisma.stockLevel.findUnique({
      where: {
        tenant_id_branch_id_product_id: {
          tenant_id: harness.alpha.tenantId,
          branch_id: harness.alpha.branchId,
          product_id: alphaProductId,
        },
      },
    });
    expect(Number(stockLevel?.current_quantity)).toBe(100);

    // 3. Verify product cost_price was updated to 4000 paisa (from 3500)
    const product = await prisma.product.findUnique({
      where: { id: alphaProductId },
    });
    expect(Number(product?.cost_price)).toBe(4000);

    // 4. Verify supplier balance was updated to 447,000 paisa
    const supplier = await prisma.supplier.findUnique({
      where: { id: alphaSupplier1Id },
    });
    expect(Number(supplier?.current_balance_paisa)).toBe(447000);

    // 5. Verify supplier ledger entry
    const ledger = await request(app.getHttpServer())
      .get(`/api/v1/purchasing/suppliers/${alphaSupplier1Id}/ledger`)
      .set(harness.alpha.authHeaders);

    // Most recent is first (order by created_at desc)
    expect(ledger.body.data[0].type).toBe('INVOICE');
    expect(Number(ledger.body.data[0].amount_paisa)).toBe(397000);
    expect(Number(ledger.body.data[0].balance_after_paisa)).toBe(447000);
  });

  it('recalculates weighted average cost on subsequent purchases with existing stock', async () => {
    // Current stock: 100 units @ 4000 paisa (value = 400,000)
    // Buy 100 more units @ 5000 paisa (value = 500,000)
    // New weighted avg = (400,000 + 500,000) / 200 = 4500 paisa!

    const invoiceNumber = `INV-WAC-${Date.now()}`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/purchasing/invoices')
      .set(harness.alpha.authHeaders)
      .send({
        supplierId: alphaSupplier1Id,
        branchId: harness.alpha.branchId,
        invoiceNumber,
        items: [
          {
            productId: alphaProductId,
            quantity: 100,
            unitCostPaisa: 5000,
          },
        ],
      });

    expect(res.status).toBe(201);

    // Stock should now be 200
    const stockLevel = await prisma.stockLevel.findUnique({
      where: {
        tenant_id_branch_id_product_id: {
          tenant_id: harness.alpha.tenantId,
          branch_id: harness.alpha.branchId,
          product_id: alphaProductId,
        },
      },
    });
    expect(Number(stockLevel?.current_quantity)).toBe(200);

    // Product cost_price should be 4500
    const prod = await prisma.product.findUnique({
      where: { id: alphaProductId },
    });
    expect(Number(prod?.cost_price)).toBe(4500);
  });

  it('supports purchase invoice with immediate partial payment', async () => {
    // Supplier 2: current balance 0.
    // Invoice: 10 units of Teer Soybean Oil @ 80,000 paisa = 800,000 paisa.
    // Paid immediately: 300,000 paisa (3,000 BDT).
    // Remaining payable balance should be 500,000 paisa!

    const invoiceNumber = `INV-TEER-${Date.now()}`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/purchasing/invoices')
      .set(harness.alpha.authHeaders)
      .send({
        supplierId: alphaSupplier2Id,
        branchId: harness.alpha.branchId,
        invoiceNumber,
        items: [
          {
            productId: alphaProduct2Id,
            quantity: 10,
            unitCostPaisa: 80000,
          },
        ],
        paidAmountPaisa: 300000,
        paymentMethod: 'BANK_TRANSFER',
      });

    expect(res.status).toBe(201);
    expect(Number(res.body.data.total_paisa)).toBe(800000);
    expect(Number(res.body.data.paid_amount_paisa)).toBe(300000);

    const supplier2 = await prisma.supplier.findUnique({
      where: { id: alphaSupplier2Id },
    });
    expect(Number(supplier2?.current_balance_paisa)).toBe(500000);

    // Check ledger entries: 1 INVOICE (+800,000) and 1 PAYMENT (-300,000)
    const ledger = await request(app.getHttpServer())
      .get(`/api/v1/purchasing/suppliers/${alphaSupplier2Id}/ledger`)
      .set(harness.alpha.authHeaders);

    expect(ledger.body.data).toHaveLength(2);
    // Entry 0 (most recent): PAYMENT -300000, balance_after = 500000
    expect(ledger.body.data[0].type).toBe('PAYMENT');
    expect(Number(ledger.body.data[0].amount_paisa)).toBe(-300000);
    expect(Number(ledger.body.data[0].balance_after_paisa)).toBe(500000);

    // Entry 1: INVOICE +800000, balance_after = 800000
    expect(ledger.body.data[1].type).toBe('INVOICE');
    expect(Number(ledger.body.data[1].amount_paisa)).toBe(800000);
    expect(Number(ledger.body.data[1].balance_after_paisa)).toBe(800000);
  });

  // ================= 3. SUPPLIER PAYMENTS =================

  it('records standalone supplier payment and updates balance', async () => {
    // Supplier 2 has 500,000 payable.
    // Pay 200,000 paisa via CASH.
    // Balance becomes 300,000 paisa.

    const res = await request(app.getHttpServer())
      .post('/api/v1/purchasing/payments')
      .set(harness.alpha.authHeaders)
      .send({
        supplierId: alphaSupplier2Id,
        amountPaisa: 200000,
        paymentMethod: 'CASH',
        notes: 'Cash voucher #CV-991',
      });

    expect(res.status).toBe(201);
    expect(Number(res.body.data.amount_paisa)).toBe(200000);

    const supplier2 = await prisma.supplier.findUnique({
      where: { id: alphaSupplier2Id },
    });
    expect(Number(supplier2?.current_balance_paisa)).toBe(300000);
  });

  // ================= 4. PURCHASE RETURNS =================

  it('records purchase return, deducts stock, and decrements supplier payable balance', async () => {
    // Current stock of Teer Oil: 10 units.
    // Supplier 2 balance: 300,000 paisa.
    // Return 2 units @ 80,000 paisa = 160,000 paisa.
    // Stock should drop to 8 units.
    // Supplier 2 balance should drop to 140,000 paisa.

    const res = await request(app.getHttpServer())
      .post('/api/v1/purchasing/returns')
      .set(harness.alpha.authHeaders)
      .send({
        supplierId: alphaSupplier2Id,
        branchId: harness.alpha.branchId,
        reason: 'Damaged bottles in shipment',
        items: [
          {
            productId: alphaProduct2Id,
            quantity: 2,
            unitCostPaisa: 80000,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(Number(res.body.data.total_paisa)).toBe(160000);

    // Verify stock dropped by 2
    const stockLevel = await prisma.stockLevel.findUnique({
      where: {
        tenant_id_branch_id_product_id: {
          tenant_id: harness.alpha.tenantId,
          branch_id: harness.alpha.branchId,
          product_id: alphaProduct2Id,
        },
      },
    });
    expect(Number(stockLevel?.current_quantity)).toBe(8);

    // Verify stock movement of type PURCHASE_RETURN with -2
    const movements = await prisma.stockMovement.findMany({
      where: {
        tenant_id: harness.alpha.tenantId,
        product_id: alphaProduct2Id,
        type: 'PURCHASE_RETURN',
      },
    });
    expect(movements).toHaveLength(1);
    expect(Number(movements[0].quantity)).toBe(-2);

    // Verify supplier balance is 140,000 paisa
    const supplier2 = await prisma.supplier.findUnique({
      where: { id: alphaSupplier2Id },
    });
    expect(Number(supplier2?.current_balance_paisa)).toBe(140000);

    // Verify ledger entry
    const ledger = await request(app.getHttpServer())
      .get(`/api/v1/purchasing/suppliers/${alphaSupplier2Id}/ledger`)
      .set(harness.alpha.authHeaders);

    expect(ledger.body.data[0].type).toBe('RETURN');
    expect(Number(ledger.body.data[0].amount_paisa)).toBe(-160000);
    expect(Number(ledger.body.data[0].balance_after_paisa)).toBe(140000);
  });

  // ================= 5. INVARIANTS & AUDIT INTEGRITY =================

  it('handles 10 parallel concurrent payments to same supplier without balance drift', async () => {
    // Current balance of Supplier 1:
    const initialSup = await prisma.supplier.findUnique({
      where: { id: alphaSupplier1Id },
    });
    const startBal = initialSup?.current_balance_paisa ?? 0n;

    // Fire 10 parallel payments of 500 paisa each = 5,000 paisa total
    const paymentPromises = Array.from({ length: 10 }, (_, i) =>
      request(app.getHttpServer())
        .post('/api/v1/purchasing/payments')
        .set(harness.alpha.authHeaders)
        .send({
          supplierId: alphaSupplier1Id,
          amountPaisa: 500,
          paymentMethod: 'CASH',
          notes: `Parallel payment ${i + 1}`,
        }),
    );

    const results = await Promise.all(paymentPromises);
    for (const r of results) {
      expect(r.status).toBe(201);
    }

    // Verify balance after all 10 payments
    const finalSup = await prisma.supplier.findUnique({
      where: { id: alphaSupplier1Id },
    });
    expect(finalSup?.current_balance_paisa).toBe(startBal - 5000n);

    // Verify ledger sum matches balance exactly
    const ledgerEntries = await prisma.supplierLedger.findMany({
      where: {
        tenant_id: harness.alpha.tenantId,
        supplier_id: alphaSupplier1Id,
      },
    });
    const sumPaisa = ledgerEntries.reduce((sum, row) => sum + row.amount_paisa, 0n);
    expect(finalSup?.current_balance_paisa).toBe(sumPaisa);
  });

  it('enforces Invariant 7: supplier_ledger is strictly append-only in Postgres', async () => {
    const [entry] = await prisma.supplierLedger.findMany({
      where: { tenant_id: harness.alpha.tenantId },
      take: 1,
    });
    expect(entry).toBeDefined();

    // Attempting raw UPDATE on supplier_ledger must be rejected by PostgreSQL trigger
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE supplier_ledger SET amount_paisa = 999999 WHERE id = '${entry.id}'::uuid`,
      ),
    ).rejects.toThrow(/supplier_ledger is append-only/);

    // Attempting raw DELETE on supplier_ledger must also be rejected
    await expect(
      prisma.$executeRawUnsafe(
        `DELETE FROM supplier_ledger WHERE id = '${entry.id}'::uuid`,
      ),
    ).rejects.toThrow(/supplier_ledger is append-only/);
  });

  it('maintains Invariant: supplier balance exactly equals sum of ledger entries', async () => {
    // For Supplier 2:
    const supplier2 = await prisma.supplier.findUnique({
      where: { id: alphaSupplier2Id },
    });

    const ledgerEntries = await prisma.supplierLedger.findMany({
      where: {
        tenant_id: harness.alpha.tenantId,
        supplier_id: alphaSupplier2Id,
      },
    });

    const sumPaisa = ledgerEntries.reduce(
      (sum, row) => sum + row.amount_paisa,
      0n,
    );

    expect(supplier2?.current_balance_paisa).toBe(sumPaisa);
  });

  it('generates payables report with accurate outstanding balances across suppliers', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/purchasing/payables')
      .set(harness.alpha.authHeaders);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { totalPayablesPaisa, payableSuppliersCount, suppliers } = res.body.data;
    expect(payableSuppliersCount).toBeGreaterThanOrEqual(2);

    // Sum of balances should match totalPayablesPaisa
    const calculatedTotal = suppliers.reduce(
      (sum: number, s: any) => sum + (s.current_balance_paisa > 0 ? s.current_balance_paisa : 0),
      0,
    );
    expect(totalPayablesPaisa).toBe(calculatedTotal);
  });

  // ================= 6. RBAC & PERMISSION CHECKS =================

  it('allows STOREKEEPER to receive goods, but forbids payments and managing suppliers', async () => {
    // Storekeeper can create invoice (goods receipt)
    const invRes = await request(app.getHttpServer())
      .post('/api/v1/purchasing/invoices')
      .set({ authorization: storekeeperToken })
      .send({
        supplierId: alphaSupplier1Id,
        branchId: harness.alpha.branchId,
        invoiceNumber: `INV-SK-${Date.now()}`,
        items: [{ productId: alphaProductId, quantity: 5, unitCostPaisa: 4000 }],
      });
    expect(invRes.status).toBe(201);

    // Storekeeper CANNOT record payments (needs purchasing.pay)
    const payRes = await request(app.getHttpServer())
      .post('/api/v1/purchasing/payments')
      .set({ authorization: storekeeperToken })
      .send({
        supplierId: alphaSupplier1Id,
        amountPaisa: 10000,
        paymentMethod: 'CASH',
      });
    expect(payRes.status).toBe(403);

    // Storekeeper CANNOT create suppliers (needs purchasing.manage)
    const supRes = await request(app.getHttpServer())
      .post('/api/v1/purchasing/suppliers')
      .set({ authorization: storekeeperToken })
      .send({ name: 'Unauthorized Supplier' });
    expect(supRes.status).toBe(403);
  });

  it('forbids CASHIER from accessing any purchasing endpoints', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/purchasing/suppliers')
      .set({ authorization: cashierToken });

    expect(res.status).toBe(403);

    const invRes = await request(app.getHttpServer())
      .get('/api/v1/purchasing/invoices')
      .set({ authorization: cashierToken });

    expect(invRes.status).toBe(403);
  });

  // ================= 7. CROSS-TENANT ISOLATION =================

  it('enforces strict cross-tenant isolation on purchasing entities', async () => {
    // Tenant Beta cannot view Tenant Alpha's supplier
    const supRes = await request(app.getHttpServer())
      .get(`/api/v1/purchasing/suppliers/${alphaSupplier1Id}`)
      .set(harness.beta.authHeaders);
    expect(supRes.status).toBe(404);

    // Tenant Beta cannot view Tenant Alpha's invoice
    const invRes = await request(app.getHttpServer())
      .get(`/api/v1/purchasing/invoices/${alphaInvoice1Id}`)
      .set(harness.beta.authHeaders);
    expect(invRes.status).toBe(404);

    // Tenant Beta cannot purchase Tenant Alpha's product
    const crossInv = await request(app.getHttpServer())
      .post('/api/v1/purchasing/invoices')
      .set(harness.beta.authHeaders)
      .send({
        supplierId: betaSupplierId,
        branchId: harness.beta.branchId,
        invoiceNumber: `INV-BETA-CROSS-${Date.now()}`,
        items: [{ productId: alphaProductId, quantity: 10, unitCostPaisa: 1000 }],
      });
    // Record movement will reject product not found for tenant
    expect(crossInv.status).toBe(404);

    // Tenant Beta payables report contains ONLY Tenant Beta's suppliers
    const betaPayables = await request(app.getHttpServer())
      .get('/api/v1/purchasing/payables')
      .set(harness.beta.authHeaders);
    expect(betaPayables.status).toBe(200);
    const betaSupplierIds = betaPayables.body.data.suppliers.map((s: any) => s.id);
    expect(betaSupplierIds).toContain(betaSupplierId);
    expect(betaSupplierIds).not.toContain(alphaSupplier1Id);
    expect(betaSupplierIds).not.toContain(alphaSupplier2Id);
  });
});
