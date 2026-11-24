import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { TokenService } from './services/token.service.js';
import { LoginThrottlerService } from './services/throttler.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RbacGuard } from './guards/rbac.guard.js';
import { BranchAccessGuard } from './guards/branch-access.guard.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    LoginThrottlerService,
    JwtAuthGuard,
    RbacGuard,
    BranchAccessGuard,
  ],
  exports: [
    AuthService,
    TokenService,
    LoginThrottlerService,
    JwtAuthGuard,
    RbacGuard,
    BranchAccessGuard,
  ],
})
export class AuthModule {}
