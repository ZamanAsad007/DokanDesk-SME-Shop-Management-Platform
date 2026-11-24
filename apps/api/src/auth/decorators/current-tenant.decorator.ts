import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { getTenantId } from '../../common/tenancy/tenant-context.js';

export const CurrentTenant = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.user?.tenantId || getTenantId();
});
