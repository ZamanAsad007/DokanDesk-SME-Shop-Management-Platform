import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service.js';
import { InventoryController } from './inventory.controller.js';
import { PrismaModule } from '../common/prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
