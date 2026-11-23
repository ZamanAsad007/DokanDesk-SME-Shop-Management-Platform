import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { runWithTenantContext, TenantContextPayload } from './tenant-context.js';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Extract tenant ID from header (or jwt payload in auth guard)
    const headerTenantId = req.headers['x-tenant-id'];
    const tenantId = Array.isArray(headerTenantId)
      ? headerTenantId[0]
      : headerTenantId;

    if (tenantId) {
      const context: TenantContextPayload = {
        tenantId,
        branchId: (req.headers['x-branch-id'] as string) || undefined,
      };

      runWithTenantContext(context, () => next());
    } else {
      next();
    }
  }
}
