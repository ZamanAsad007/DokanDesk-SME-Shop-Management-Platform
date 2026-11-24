import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service.js';
import { createUserSchema } from './dto/create-user.dto.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import { updateUserSchema } from './dto/update-user.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RbacGuard } from '../auth/guards/rbac.guard.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthTokenPayload } from '../auth/services/token.service.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { Permission, offsetPaginationSchema } from '@dokandesk/shared';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('users')
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions(Permission.USERS_VIEW)
  @ApiOperation({ summary: 'List shop staff members with pagination' })
  @ApiResponse({ status: 200, description: 'Users list retrieved successfully' })
  async listUsers(
    @CurrentTenant() tenantId: string,
    @Query(new ZodValidationPipe(offsetPaginationSchema))
    query: { page: number; limit: number },
  ) {
    return this.usersService.listUsers(tenantId, query.page, query.limit);
  }

  @Post()
  @RequirePermissions(Permission.USERS_MANAGE)
  @ApiOperation({ summary: 'Create / invite a staff user with role and branch assignments' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'Email already exists in shop' })
  async createUser(
    @CurrentTenant() tenantId: string,
    @CurrentUser() creator: AuthTokenPayload,
    @Body(new ZodValidationPipe(createUserSchema)) dto: CreateUserDto,
  ) {
    return this.usersService.createUser(tenantId, creator.sub, dto);
  }

  @Get(':id')
  @RequirePermissions(Permission.USERS_VIEW)
  @ApiOperation({ summary: 'Get user details by ID' })
  @ApiResponse({ status: 200, description: 'User details retrieved' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUser(@CurrentTenant() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getUser(tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.USERS_MANAGE)
  @ApiOperation({ summary: 'Update user role, status, or branch assignments' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUser(
    @CurrentTenant() tenantId: string,
    @CurrentUser() updater: AuthTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) dto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(tenantId, updater.sub, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.USERS_MANAGE)
  @ApiOperation({ summary: 'Deactivate a staff member' })
  @ApiResponse({ status: 200, description: 'User deactivated successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete owner account' })
  async deleteUser(
    @CurrentTenant() tenantId: string,
    @CurrentUser() updater: AuthTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.deleteUser(tenantId, updater.sub, id);
  }
}
