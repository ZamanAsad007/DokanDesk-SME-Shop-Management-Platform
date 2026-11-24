import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BranchesService } from './branches.service.js';
import { createBranchSchema } from './dto/create-branch.dto.js';
import type { CreateBranchDto } from './dto/create-branch.dto.js';
import { updateBranchSchema } from './dto/update-branch.dto.js';
import type { UpdateBranchDto } from './dto/update-branch.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RbacGuard } from '../auth/guards/rbac.guard.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthTokenPayload } from '../auth/services/token.service.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { Permission } from '@dokandesk/shared';

@ApiTags('Branches')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('branches')
export class BranchesController {
  constructor(@Inject(BranchesService) private readonly branchesService: BranchesService) {}

  @Get()
  @RequirePermissions(Permission.BRANCHES_VIEW)
  @ApiOperation({ summary: 'List all branches for the shop' })
  @ApiResponse({ status: 200, description: 'Branches retrieved successfully' })
  async listBranches(@CurrentTenant() tenantId: string) {
    return this.branchesService.listBranches(tenantId);
  }

  @Post()
  @RequirePermissions(Permission.BRANCHES_MANAGE)
  @ApiOperation({ summary: 'Create a new branch' })
  @ApiResponse({ status: 201, description: 'Branch created successfully' })
  @ApiResponse({ status: 409, description: 'Branch code already in use' })
  async createBranch(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthTokenPayload,
    @Body(new ZodValidationPipe(createBranchSchema)) dto: CreateBranchDto,
  ) {
    return this.branchesService.createBranch(tenantId, user.sub, dto);
  }

  @Get(':id')
  @RequirePermissions(Permission.BRANCHES_VIEW)
  @ApiOperation({ summary: 'Get branch details by ID' })
  @ApiResponse({ status: 200, description: 'Branch details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  async getBranch(@CurrentTenant() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.branchesService.getBranch(tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.BRANCHES_MANAGE)
  @ApiOperation({ summary: 'Update branch information' })
  @ApiResponse({ status: 200, description: 'Branch updated successfully' })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  async updateBranch(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateBranchSchema)) dto: UpdateBranchDto,
  ) {
    return this.branchesService.updateBranch(tenantId, user.sub, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.BRANCHES_MANAGE)
  @ApiOperation({ summary: 'Delete a non-main branch' })
  @ApiResponse({ status: 200, description: 'Branch deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete main branch' })
  async deleteBranch(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.branchesService.deleteBranch(tenantId, user.sub, id);
  }
}
