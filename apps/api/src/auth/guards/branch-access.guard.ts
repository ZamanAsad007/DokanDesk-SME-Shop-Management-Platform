import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { ApiErrorCode, Role } from '@dokandesk/shared';

@Injectable()
export class BranchAccessGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const branchId =
      request.params?.branchId || request.query?.branchId || request.headers['x-branch-id'];

    if (!branchId) {
      return true;
    }

    const user = request.user;
    if (!user) {
      return true;
    }

    // Owners and Managers have access to all branches within the tenant
    if (user.role === Role.OWNER || user.role === Role.MANAGER) {
      return true;
    }

    // Cashiers, accountants, and storekeepers must be assigned to the branch
    const assignment = await this.prisma.userBranch.findFirst({
      where: {
        tenant_id: user.tenantId,
        user_id: user.sub,
        branch_id: branchId,
      },
    });

    if (!assignment) {
      throw new ForbiddenException({
        code: ApiErrorCode.BRANCH_ACCESS_DENIED,
        message: 'You do not have permission to access or operate on this branch',
      });
    }

    return true;
  }
}
