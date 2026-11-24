import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { getTenantId } from './tenant-context.js';
import { ApiErrorCode } from '@dokandesk/shared';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    const tenantId = getTenantId();
    if (!tenantId) {
      throw new UnauthorizedException({
        code: ApiErrorCode.TENANT_NOT_FOUND,
        message: 'Tenant context is missing or invalid',
      });
    }
    return true;
  }
}
