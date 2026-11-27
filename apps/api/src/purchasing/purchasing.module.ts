import { Module } from '@nestjs/common';
import { PurchasingService } from './purchasing.service.js';
import { PurchasingController } from './purchasing.controller.js';
import { PrismaModule } from '../common/prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';

@Module({
  imports: [PrismaModule, AuthModule, InventoryModule],
  controllers: [PurchasingController],
  providers: [PurchasingService],
  exports: [PurchasingService],
})
export class PurchasingModule {}
