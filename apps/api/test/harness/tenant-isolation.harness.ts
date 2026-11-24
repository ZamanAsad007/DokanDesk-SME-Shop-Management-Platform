import { INestApplication } from '@nestjs/common';
import request from 'supertest';

export interface TenantActor {
  tenantId: string;
  tenantSlug: string;
  ownerId: string;
  ownerEmail: string;
  branchId: string;
  accessToken: string;
  refreshToken: string;
  authHeaders: {
    Authorization: string;
    'x-tenant-id': string;
  };
}

export interface TenantIsolationHarness {
  alpha: TenantActor;
  beta: TenantActor;
  request: (app: INestApplication) => ReturnType<typeof request>;
}

/**
 * Creates two completely separate tenants (Alpha and Beta) via the real auth registration API.
 * This harness provides tokens and headers to verify that no route leaks data across tenants.
 */
export async function setupTenantIsolationHarness(
  app: INestApplication,
  suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
): Promise<TenantIsolationHarness> {
  const server = app.getHttpServer();

  // 1. Register Tenant Alpha
  const alphaSlug = `alpha-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const alphaRes = await request(server)
    .post('/api/v1/auth/register')
    .send({
      shopName: `Shop Alpha ${suffix}`,
      shopSlug: alphaSlug,
      ownerName: 'Alpha Owner',
      ownerEmail: `owner-${alphaSlug}@example.com`,
      ownerPassword: 'PasswordAlpha123!',
      currency: 'BDT',
      vatRatePercent: 7.5,
      allowNegativeStock: false,
    });

  if (alphaRes.status !== 201) {
    throw new Error(`Failed to create Tenant Alpha: ${JSON.stringify(alphaRes.body)}`);
  }

  const alphaData = alphaRes.body.data;
  const alpha: TenantActor = {
    tenantId: alphaData.tenant.id,
    tenantSlug: alphaData.tenant.slug,
    ownerId: alphaData.user.id,
    ownerEmail: alphaData.user.email,
    branchId: alphaData.branch.id,
    accessToken: alphaData.tokens.accessToken,
    refreshToken: alphaData.tokens.refreshToken,
    authHeaders: {
      Authorization: `Bearer ${alphaData.tokens.accessToken}`,
      'x-tenant-id': alphaData.tenant.id,
    },
  };

  // 2. Register Tenant Beta
  const betaSlug = `beta-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const betaRes = await request(server)
    .post('/api/v1/auth/register')
    .send({
      shopName: `Shop Beta ${suffix}`,
      shopSlug: betaSlug,
      ownerName: 'Beta Owner',
      ownerEmail: `owner-${betaSlug}@example.com`,
      ownerPassword: 'PasswordBeta123!',
      currency: 'BDT',
      vatRatePercent: 5.0,
      allowNegativeStock: true,
    });

  if (betaRes.status !== 201) {
    throw new Error(`Failed to create Tenant Beta: ${JSON.stringify(betaRes.body)}`);
  }

  const betaData = betaRes.body.data;
  const beta: TenantActor = {
    tenantId: betaData.tenant.id,
    tenantSlug: betaData.tenant.slug,
    ownerId: betaData.user.id,
    ownerEmail: betaData.user.email,
    branchId: betaData.branch.id,
    accessToken: betaData.tokens.accessToken,
    refreshToken: betaData.tokens.refreshToken,
    authHeaders: {
      Authorization: `Bearer ${betaData.tokens.accessToken}`,
      'x-tenant-id': betaData.tenant.id,
    },
  };

  return {
    alpha,
    beta,
    request: () => request(server),
  };
}
