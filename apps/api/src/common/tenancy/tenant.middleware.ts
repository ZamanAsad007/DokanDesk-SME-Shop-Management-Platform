import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { runWithTenantContext, TenantContextPayload } from './tenant-context.js';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Extract tenant ID from header or bearer token payload
    const headerTenantId = req.headers['x-tenant-id'];
    let tenantId = Array.isArray(headerTenantId) ? headerTenantId[0] : headerTenantId;

    if (!tenantId && req.headers.authorization?.startsWith('Bearer ')) {
      try {
        const token = req.headers.authorization.slice(7);
        const decoded = jwt.decode(token) as any;
        if (decoded?.tenantId) {
          tenantId = decoded.tenantId;
        }
      } catch {
        // Ignored here; JwtAuthGuard will properly validate signature and format
      }
    }

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
