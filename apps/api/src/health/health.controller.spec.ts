import { describe, it, expect, vi } from 'vitest';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  const controller = new HealthController();

  it('health() returns ok status with uptime and timestamp', () => {
    const result = controller.health();
    expect(result.status).toBe('ok');
    expect(result.uptime).toBeGreaterThanOrEqual(0);
    expect(result.timestamp).toBeDefined();
  });

  it('ready() returns ok status when dependencies are healthy', () => {
    const mockRes: any = {
      status: vi.fn(),
    };
    const result = controller.ready(mockRes);
    expect(result.status).toBe('ok');
    expect(result.checks.database).toBe('up');
    expect(result.checks.redis).toBe('up');
  });
});
