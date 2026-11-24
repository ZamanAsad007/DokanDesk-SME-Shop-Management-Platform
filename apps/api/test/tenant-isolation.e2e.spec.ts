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
import { ApiErrorCode, Role } from '@dokandesk/shared';

describe('Tenant Isolation & RBAC (e2e)', () => {
  let app: INestApplication;
  let harness: TenantIsolationHarness;

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
    harness = await setupTenantIsolationHarness(app);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('1. Auth & Token Rotation Flow', () => {
    it('allows registered owner to get /me profile with full permissions', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set(harness.alpha.authHeaders);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(harness.alpha.ownerEmail);
      expect(res.body.data.role).toBe(Role.OWNER);
      expect(res.body.data.permissions.length).toBeGreaterThan(10);
    });

    it('rotates refresh token and invalidates the previous one', async () => {
      const refreshRes = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: harness.alpha.refreshToken });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.success).toBe(true);
      expect(refreshRes.body.data).toHaveProperty('accessToken');
      expect(refreshRes.body.data).toHaveProperty('refreshToken');

      // Attempting to reuse old refresh token must fail
      const reuseRes = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: harness.alpha.refreshToken });

      expect(reuseRes.status).toBe(401);
      expect(reuseRes.body.error.code).toBe(ApiErrorCode.UNAUTHORIZED);
    });
  });

  describe('2. RBAC Enforcement', () => {
    let cashierToken: string;

    beforeAll(async () => {
      // Create a cashier in Tenant Alpha
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/users')
        .set(harness.alpha.authHeaders)
        .send({
          name: 'Alpha Cashier',
          email: `cashier-${Date.now()}@alpha.com`,
          password: 'PasswordCashier123!',
          role: Role.CASHIER,
        });

      expect(createRes.status).toBe(201);
      const cashierEmail = createRes.body.data.email;

      // Cashier logs in
      const loginRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
        email: cashierEmail,
        password: 'PasswordCashier123!',
        tenantSlug: harness.alpha.tenantSlug,
      });

      expect(loginRes.status).toBe(200);
      cashierToken = loginRes.body.data.tokens.accessToken;
    });

    it('forbids cashier from modifying shop settings (requires settings.manage)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/tenants/settings')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({ allowNegativeStock: true });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe(ApiErrorCode.FORBIDDEN);
    });

    it('allows owner to modify shop settings', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/tenants/settings')
        .set(harness.alpha.authHeaders)
        .send({ allowNegativeStock: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.allowNegativeStock).toBe(true);
    });
  });

  describe('3. Strict Cross-Tenant Isolation', () => {
    let alphaBranchId: string;
    let alphaStaffId: string;

    beforeAll(async () => {
      // Create a new branch in Tenant Alpha
      const branchRes = await request(app.getHttpServer())
        .post('/api/v1/branches')
        .set(harness.alpha.authHeaders)
        .send({
          name: 'Gulshan Branch',
          code: 'GUL-1',
          address: 'Gulshan, Dhaka',
        });
      expect(branchRes.status).toBe(201);
      alphaBranchId = branchRes.body.data.id;

      // Create a staff user in Tenant Alpha
      const userRes = await request(app.getHttpServer())
        .post('/api/v1/users')
        .set(harness.alpha.authHeaders)
        .send({
          name: 'Alpha Manager',
          email: `mgr-${Date.now()}@alpha.com`,
          password: 'PasswordManager123!',
          role: Role.MANAGER,
        });
      expect(userRes.status).toBe(201);
      alphaStaffId = userRes.body.data.id;
    });

    it('prevents Tenant Beta from seeing Tenant Alpha branch in list', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/branches')
        .set(harness.beta.authHeaders);

      expect(res.status).toBe(200);
      const branchIds = res.body.data.map((b: any) => b.id);
      expect(branchIds).not.toContain(alphaBranchId);
    });

    it('returns 404 when Tenant Beta queries Tenant Alpha branch by ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/branches/${alphaBranchId}`)
        .set(harness.beta.authHeaders);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe(ApiErrorCode.NOT_FOUND);
    });

    it('returns 404 when Tenant Beta attempts to update Tenant Alpha branch', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/branches/${alphaBranchId}`)
        .set(harness.beta.authHeaders)
        .send({ name: 'Hacked Branch Name' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe(ApiErrorCode.NOT_FOUND);
    });

    it('prevents Tenant Beta from viewing Tenant Alpha user details', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/users/${alphaStaffId}`)
        .set(harness.beta.authHeaders);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe(ApiErrorCode.NOT_FOUND);
    });

    it('detects and rejects tenant spoofing via x-tenant-id header mismatch', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/branches')
        .set('Authorization', `Bearer ${harness.beta.accessToken}`)
        .set('x-tenant-id', harness.alpha.tenantId); // Spoofing alpha's tenant ID with beta's token

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe(ApiErrorCode.UNAUTHORIZED);
    });
  });
});
