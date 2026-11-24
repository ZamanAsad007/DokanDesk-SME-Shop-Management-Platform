import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator.js';
import { ROLES_KEY } from '../decorators/require-roles.decorator.js';
import { ApiErrorCode, hasAllPermissions, Permission, Role } from '@dokandesk/shared';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[] | undefined>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If route has no RBAC requirements, allow access
    if (!requiredPermissions?.length && !requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      throw new UnauthorizedException({
        code: ApiErrorCode.UNAUTHORIZED,
        message: 'Authentication required for RBAC evaluation',
      });
    }

    // Role check if explicit roles are required
    if (requiredRoles?.length) {
      const hasMatchingRole = requiredRoles.includes(user.role as Role);
      if (!hasMatchingRole) {
        throw new ForbiddenException({
          code: ApiErrorCode.FORBIDDEN,
          message: `Access denied. Requires one of roles: ${requiredRoles.join(', ')}`,
        });
      }
    }

    // Permission check if permissions are required
    if (requiredPermissions?.length) {
      const hasPermissions = hasAllPermissions(user.role as Role, requiredPermissions);
      if (!hasPermissions) {
        throw new ForbiddenException({
          code: ApiErrorCode.FORBIDDEN,
          message: `Access denied. Missing required permissions: ${requiredPermissions.join(', ')}`,
        });
      }
    }

    return true;
  }
}
