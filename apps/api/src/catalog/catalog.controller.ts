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
  Header,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CatalogService } from './catalog.service.js';
import { CsvCatalogService } from './services/csv-catalog.service.js';
import { createCategorySchema, updateCategorySchema } from './dto/categories.dto.js';
import type { CreateCategoryDto, UpdateCategoryDto } from './dto/categories.dto.js';
import { createBrandSchema, updateBrandSchema } from './dto/brands.dto.js';
import type { CreateBrandDto, UpdateBrandDto } from './dto/brands.dto.js';
import { createUnitSchema, createUnitConversionSchema } from './dto/units.dto.js';
import type { CreateUnitDto, CreateUnitConversionDto } from './dto/units.dto.js';
import {
  createProductSchema,
  updateProductSchema,
  productQuerySchema,
} from './dto/products.dto.js';
import type {
  CreateProductDto,
  UpdateProductDto,
  ProductQueryInput,
} from './dto/products.dto.js';
import { createVariantSchema } from './dto/variants.dto.js';
import type { CreateVariantDto } from './dto/variants.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RbacGuard } from '../auth/guards/rbac.guard.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthTokenPayload } from '../auth/services/token.service.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { Permission } from '@dokandesk/shared';

@ApiTags('Catalog')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('catalog')
export class CatalogController {
  constructor(
    @Inject(CatalogService) private readonly catalogService: CatalogService,
    @Inject(CsvCatalogService) private readonly csvService: CsvCatalogService,
  ) {}

  // ================= CATEGORIES =================

  @Get('categories')
  @RequirePermissions(Permission.CATALOG_VIEW)
  @ApiOperation({ summary: 'List all categories in shop' })
  async listCategories(@CurrentTenant() tenantId: string) {
    return this.catalogService.listCategories(tenantId);
  }

  @Post('categories')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @ApiOperation({ summary: 'Create a category' })
  async createCategory(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthTokenPayload,
    @Body(new ZodValidationPipe(createCategorySchema)) dto: CreateCategoryDto,
  ) {
    return this.catalogService.createCategory(tenantId, user.sub, dto);
  }

  @Get('categories/:id')
  @RequirePermissions(Permission.CATALOG_VIEW)
  @ApiOperation({ summary: 'Get category by ID' })
  async getCategory(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.catalogService.getCategory(tenantId, id);
  }

  @Patch('categories/:id')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @ApiOperation({ summary: 'Update a category' })
  async updateCategory(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateCategorySchema)) dto: UpdateCategoryDto,
  ) {
    return this.catalogService.updateCategory(tenantId, user.sub, id, dto);
  }

  @Delete('categories/:id')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @ApiOperation({ summary: 'Delete a category' })
  async deleteCategory(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.catalogService.deleteCategory(tenantId, user.sub, id);
  }

  // ================= BRANDS =================

  @Get('brands')
  @RequirePermissions(Permission.CATALOG_VIEW)
  @ApiOperation({ summary: 'List all brands in shop' })
  async listBrands(@CurrentTenant() tenantId: string) {
    return this.catalogService.listBrands(tenantId);
  }

  @Post('brands')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @ApiOperation({ summary: 'Create a brand' })
  async createBrand(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthTokenPayload,
    @Body(new ZodValidationPipe(createBrandSchema)) dto: CreateBrandDto,
  ) {
    return this.catalogService.createBrand(tenantId, user.sub, dto);
  }

  @Get('brands/:id')
  @RequirePermissions(Permission.CATALOG_VIEW)
  @ApiOperation({ summary: 'Get brand by ID' })
  async getBrand(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.catalogService.getBrand(tenantId, id);
  }

  @Patch('brands/:id')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @ApiOperation({ summary: 'Update a brand' })
  async updateBrand(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateBrandSchema)) dto: UpdateBrandDto,
  ) {
    return this.catalogService.updateBrand(tenantId, user.sub, id, dto);
  }

  @Delete('brands/:id')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @ApiOperation({ summary: 'Delete a brand' })
  async deleteBrand(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.catalogService.deleteBrand(tenantId, user.sub, id);
  }

  // ================= UNITS =================

  @Get('units')
  @RequirePermissions(Permission.CATALOG_VIEW)
  @ApiOperation({ summary: 'List all units of measurement in shop' })
  async listUnits(@CurrentTenant() tenantId: string) {
    return this.catalogService.listUnits(tenantId);
  }

  @Post('units')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @ApiOperation({ summary: 'Create a unit of measurement' })
  async createUnit(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthTokenPayload,
    @Body(new ZodValidationPipe(createUnitSchema)) dto: CreateUnitDto,
  ) {
    return this.catalogService.createUnit(tenantId, user.sub, dto);
  }

  @Post('units/conversions')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @ApiOperation({ summary: 'Create or update unit conversion rule' })
  async createUnitConversion(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthTokenPayload,
    @Body(new ZodValidationPipe(createUnitConversionSchema))
    dto: CreateUnitConversionDto,
  ) {
    return this.catalogService.createConversion(tenantId, user.sub, dto);
  }

  // ================= PRODUCTS =================

  @Get('products')
  @RequirePermissions(Permission.CATALOG_VIEW)
  @ApiOperation({ summary: 'List products with search by name/SKU/barcode and filters' })
  async listProducts(
    @CurrentTenant() tenantId: string,
    @Query(new ZodValidationPipe(productQuerySchema)) query: ProductQueryInput,
  ) {
    return this.catalogService.listProducts(tenantId, query);
  }

  @Post('products')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @ApiOperation({ summary: 'Create a product' })
  @ApiResponse({ status: 201, description: 'Product created' })
  @ApiResponse({ status: 409, description: 'SKU already exists' })
  async createProduct(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthTokenPayload,
    @Body(new ZodValidationPipe(createProductSchema)) dto: CreateProductDto,
  ) {
    return this.catalogService.createProduct(tenantId, user.sub, dto);
  }

  @Get('products/:id')
  @RequirePermissions(Permission.CATALOG_VIEW)
  @ApiOperation({ summary: 'Get product details by ID' })
  async getProduct(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.catalogService.getProduct(tenantId, id);
  }

  @Patch('products/:id')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @ApiOperation({ summary: 'Update product information and pricing' })
  async updateProduct(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateProductSchema)) dto: UpdateProductDto,
  ) {
    return this.catalogService.updateProduct(tenantId, user.sub, id, dto);
  }

  @Delete('products/:id')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @ApiOperation({ summary: 'Deactivate / soft-delete a product' })
  async deleteProduct(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.catalogService.deleteProduct(tenantId, user.sub, id);
  }

  @Get('products/:id/price-history')
  @RequirePermissions(Permission.CATALOG_PRICING_VIEW)
  @ApiOperation({ summary: 'Get price change history for a product' })
  async getPriceHistory(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.catalogService.getPriceHistory(tenantId, id);
  }

  // ================= CSV IMPORT / EXPORT =================

  @Post('products/import/csv')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @ApiOperation({ summary: 'Import products in bulk from CSV string with validation report' })
  async importCsv(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthTokenPayload,
    @Body() body: { csvContent: string },
  ) {
    return this.csvService.importProductsCsv(
      tenantId,
      user.sub,
      body.csvContent || '',
    );
  }

  @Get('products/export/csv')
  @RequirePermissions(Permission.CATALOG_VIEW)
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="catalog-products.csv"')
  @ApiOperation({ summary: 'Export all products to CSV format' })
  async exportCsv(@CurrentTenant() tenantId: string) {
    return this.csvService.exportProductsCsv(tenantId);
  }

  // ================= VARIANTS =================

  @Post('products/:id/variants')
  @RequirePermissions(Permission.CATALOG_MANAGE)
  @ApiOperation({ summary: 'Add a variant to a product' })
  async addVariant(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) productId: string,
    @Body(new ZodValidationPipe(createVariantSchema)) dto: CreateVariantDto,
  ) {
    return this.catalogService.addVariant(tenantId, productId, dto);
  }

  @Get('products/:id/variants')
  @RequirePermissions(Permission.CATALOG_VIEW)
  @ApiOperation({ summary: 'List variants for a product' })
  async listVariants(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) productId: string,
  ) {
    return this.catalogService.listVariants(tenantId, productId);
  }
}
