import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { TokenService } from '../services/token.service.js';
import { ApiErrorCode } from '@dokandesk/shared';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(TokenService) private readonly tokenService: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: ApiErrorCode.UNAUTHORIZED,
        message: 'Bearer authorization header is required',
      });
    }

    const token = authHeader.slice(7).trim();
    const payload = this.tokenService.verifyAccessToken(token);

    // If an x-tenant-id header is also supplied, it must match the token's tenant
    const headerTenantId = request.headers['x-tenant-id'];
    if (headerTenantId && headerTenantId !== payload.tenantId) {
      throw new UnauthorizedException({
        code: ApiErrorCode.UNAUTHORIZED,
        message: 'Tenant mismatch between token and header',
      });
    }

    request.user = payload;
    return true;
  }
}
