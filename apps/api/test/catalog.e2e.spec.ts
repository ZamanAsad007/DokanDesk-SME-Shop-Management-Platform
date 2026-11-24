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
import { ApiErrorCode } from '@dokandesk/shared';

describe('Catalog Module & Price History (e2e)', () => {
  let app: INestApplication;
  let harness: TenantIsolationHarness;

  let unitPcsId: string;
  let categoryId: string;
  let brandId: string;
  let alphaProductId: string;

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
    harness = await setupTenantIsolationHarness(app, `cat-${Date.now()}`);

    // Create unit, category, brand in Tenant Alpha
    const unitRes = await request(app.getHttpServer())
      .post('/api/v1/catalog/units')
      .set(harness.alpha.authHeaders)
      .send({ name: 'Pieces', code: `pcs-${Date.now()}` });
    expect(unitRes.status).toBe(201);
    unitPcsId = unitRes.body.data.id;

    const catRes = await request(app.getHttpServer())
      .post('/api/v1/catalog/categories')
      .set(harness.alpha.authHeaders)
      .send({ name: 'Soft Drinks', description: 'Carbonated beverages' });
    expect(catRes.status).toBe(201);
    categoryId = catRes.body.data.id;

    const brandRes = await request(app.getHttpServer())
      .post('/api/v1/catalog/brands')
      .set(harness.alpha.authHeaders)
      .send({ name: 'Acme Beverages' });
    expect(brandRes.status).toBe(201);
    brandId = brandRes.body.data.id;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('1. Product CRUD with Integer Paisa & Search', () => {
    it('creates product with exact integer paisa amounts and initial price history', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/catalog/products')
        .set(harness.alpha.authHeaders)
        .send({
          name: 'Premium Cola 330ml',
          sku: `COLA-${Date.now()}`,
          barcode: '894000112233',
          unitId: unitPcsId,
          categoryId,
          brandId,
          costPricePaisa: 3200, // 32.00 BDT
          sellingPricePaisa: 4500, // 45.00 BDT
          mrpPaisa: 4500,
          vatRatePercent: 7.5,
          reorderLevel: 25,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.costPricePaisa).toBe(3200);
      expect(res.body.data.sellingPricePaisa).toBe(4500);
      expect(res.body.data.priceHistory.length).toBeGreaterThanOrEqual(1);

      alphaProductId = res.body.data.id;
    });

    it('searches product by name query', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/catalog/products?search=Cola')
        .set(harness.alpha.authHeaders);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.products.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.products[0].name).toContain('Cola');
    });

    it('searches product by exact barcode', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/catalog/products?search=894000112233')
        .set(harness.alpha.authHeaders);

      expect(res.status).toBe(200);
      expect(res.body.data.products.length).toBe(1);
      expect(res.body.data.products[0].id).toBe(alphaProductId);
    });
  });

  describe('2. Price History & Product Image Upload', () => {
    it('creates audit price history row when selling price changes', async () => {
      const updateRes = await request(app.getHttpServer())
        .patch(`/api/v1/catalog/products/${alphaProductId}`)
        .set(harness.alpha.authHeaders)
        .send({
          sellingPricePaisa: 5000, // Increased to 50.00 BDT
          priceChangeReason: 'Inflation adjustment',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.sellingPricePaisa).toBe(5000);

      // Verify price history endpoint
      const historyRes = await request(app.getHttpServer())
        .get(`/api/v1/catalog/products/${alphaProductId}/price-history`)
        .set(harness.alpha.authHeaders);

      expect(historyRes.status).toBe(200);
      expect(historyRes.body.data.length).toBeGreaterThanOrEqual(2);
      expect(historyRes.body.data[0].oldSellingPricePaisa).toBe(4500);
      expect(historyRes.body.data[0].newSellingPricePaisa).toBe(5000);
      expect(historyRes.body.data[0].changeReason).toBe('Inflation adjustment');
    });

    it('uploads and attaches a valid base64 image to product', async () => {
      // 1x1 transparent PNG in base64
      const sampleBase64Png =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

      const uploadRes = await request(app.getHttpServer())
        .post(`/api/v1/catalog/products/${alphaProductId}/image`)
        .set(harness.alpha.authHeaders)
        .send({
          filename: 'cola.png',
          mimetype: 'image/png',
          base64Data: sampleBase64Png,
        });

      expect(uploadRes.status).toBe(201);
      expect(uploadRes.body.data.imageUrl).toContain(
        `/uploads/products/${harness.alpha.tenantId}/`,
      );
    });
  });

  describe('3. Product Variants (P1)', () => {
    it('adds variant to product with specific attributes', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/catalog/products/${alphaProductId}/variants`)
        .set(harness.alpha.authHeaders)
        .send({
          name: 'Diet Edition',
          sku: `COLA-DIET-${Date.now()}`,
          attributes: { sugar: 'zero', flavor: 'original' },
          sellingPricePaisa: 5200,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Diet Edition');
      expect(res.body.data.attributes).toEqual({ sugar: 'zero', flavor: 'original' });
    });
  });

  describe('4. Cross-Tenant Isolation for Catalog', () => {
    it('prevents Tenant Beta from seeing Tenant Alpha products in catalog list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/catalog/products')
        .set(harness.beta.authHeaders);

      expect(res.status).toBe(200);
      const productIds = res.body.data.products.map((p: any) => p.id);
      expect(productIds).not.toContain(alphaProductId);
    });

    it('returns 404 when Tenant Beta requests Tenant Alpha product by ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/catalog/products/${alphaProductId}`)
        .set(harness.beta.authHeaders);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe(ApiErrorCode.NOT_FOUND);
    });

    it('returns 404 when Tenant Beta tries to update Tenant Alpha product', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/catalog/products/${alphaProductId}`)
        .set(harness.beta.authHeaders)
        .send({ name: 'Tenant Beta Hijack Attempt' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe(ApiErrorCode.NOT_FOUND);
    });

    it('returns 404 when Tenant Beta accesses Tenant Alpha category', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/catalog/categories/${categoryId}`)
        .set(harness.beta.authHeaders);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe(ApiErrorCode.NOT_FOUND);
    });
  });
});
