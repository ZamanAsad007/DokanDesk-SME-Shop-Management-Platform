import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { ApiErrorCode } from '@dokandesk/shared';

describe('DokanDesk API (e2e)', () => {
  let app: INestApplication;

  const mockPrismaService = {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    // Set fallback test environment variables if not already set
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ||
      'postgresql://test:test@localhost:5432/test?schema=public';
    process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
    process.env.JWT_ACCESS_SECRET =
      process.env.JWT_ACCESS_SECRET ||
      'test_access_secret_min_32_characters_long_for_test';
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET ||
      'test_refresh_secret_min_32_characters_long_for_test';
    process.env.WEB_ORIGIN =
      process.env.WEB_ORIGIN || 'http://localhost:5173';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/health (GET) returns status ok formatted with success envelope', async () => {
    const response = await request(app.getHttpServer()).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toHaveProperty('status', 'ok');
    expect(response.body.data).toHaveProperty('uptime');
    expect(response.body.data).toHaveProperty('timestamp');
  });

  it('/ready (GET) returns status ok formatted with success envelope', async () => {
    const response = await request(app.getHttpServer()).get('/ready');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toHaveProperty('status', 'ok');
    expect(response.body.data.checks).toHaveProperty('database', 'up');
    expect(response.body.data.checks).toHaveProperty('redis', 'up');
  });

  it('unhandled 404 route returns standardized API error structure', async () => {
    const response = await request(app.getHttpServer()).get('/non-existent-route');
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body.error).toHaveProperty('code', ApiErrorCode.NOT_FOUND);
  });
});
