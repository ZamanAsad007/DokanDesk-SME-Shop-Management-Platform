import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
import { CsvCatalogService } from './services/csv-catalog.service.js';
import { ImageUploadService } from './services/image-upload.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [CatalogController],
  providers: [CatalogService, CsvCatalogService, ImageUploadService],
  exports: [CatalogService, CsvCatalogService, ImageUploadService],
})
export class CatalogModule {}
