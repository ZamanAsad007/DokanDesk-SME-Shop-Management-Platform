import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/categories.dto.js';
import { CreateBrandDto, UpdateBrandDto } from './dto/brands.dto.js';
import { CreateUnitDto, CreateUnitConversionDto } from './dto/units.dto.js';
import { CreateProductDto, UpdateProductDto, ProductQueryInput } from './dto/products.dto.js';
import { CreateVariantDto } from './dto/variants.dto.js';
import { ApiErrorCode } from '@dokandesk/shared';

@Injectable()
export class CatalogService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // ================= CATEGORIES =================

  async listCategories(tenantId: string) {
    return this.prisma.category.findMany({
      where: { tenant_id: tenantId },
      include: {
        children: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async getCategory(tenantId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, tenant_id: tenantId },
      include: {
        children: true,
        parent: true,
      },
    });

    if (!category) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Category not found',
      });
    }

    return category;
  }

  async createCategory(tenantId: string, userId: string, dto: CreateCategoryDto) {
    if (dto.parentId) {
      const parent = await this.prisma.category.findFirst({
        where: { id: dto.parentId, tenant_id: tenantId },
      });
      if (!parent) {
        throw new BadRequestException({
          code: ApiErrorCode.BAD_REQUEST,
          message: 'Parent category not found in this shop',
        });
      }
    }

    const existing = await this.prisma.category.findFirst({
      where: {
        tenant_id: tenantId,
        name: dto.name,
        parent_id: dto.parentId || null,
      },
    });

    if (existing) {
      throw new ConflictException({
        code: ApiErrorCode.BAD_REQUEST,
        message: `Category with name '${dto.name}' already exists in this parent`,
      });
    }

    const created = await this.prisma.category.create({
      data: {
        tenant_id: tenantId,
        name: dto.name,
        parent_id: dto.parentId || null,
        description: dto.description,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenant_id: tenantId,
        user_id: userId,
        action: 'CREATE_CATEGORY',
        entity_type: 'Category',
        entity_id: created.id,
        new_values: { name: created.name },
      },
    });

    return created;
  }

  async updateCategory(tenantId: string, userId: string, id: string, dto: UpdateCategoryDto) {
    const category = await this.getCategory(tenantId, id);

    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException({
          code: ApiErrorCode.BAD_REQUEST,
          message: 'Category cannot be its own parent',
        });
      }
      const parent = await this.prisma.category.findFirst({
        where: { id: dto.parentId, tenant_id: tenantId },
      });
      if (!parent) {
        throw new BadRequestException({
          code: ApiErrorCode.BAD_REQUEST,
          message: 'Parent category not found in this shop',
        });
      }
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.parentId !== undefined ? { parent_id: dto.parentId } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenant_id: tenantId,
        user_id: userId,
        action: 'UPDATE_CATEGORY',
        entity_type: 'Category',
        entity_id: id,
        old_values: { name: category.name },
        new_values: { name: updated.name },
      },
    });

    return updated;
  }

  async deleteCategory(tenantId: string, userId: string, id: string) {
    const category = await this.getCategory(tenantId, id);

    await this.prisma.category.delete({
      where: { id },
    });

    await this.prisma.auditLog.create({
      data: {
        tenant_id: tenantId,
        user_id: userId,
        action: 'DELETE_CATEGORY',
        entity_type: 'Category',
        entity_id: id,
        old_values: { name: category.name },
      },
    });

    return { success: true, message: 'Category deleted successfully' };
  }

  // ================= BRANDS =================

  async listBrands(tenantId: string) {
    return this.prisma.brand.findMany({
      where: { tenant_id: tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async getBrand(tenantId: string, id: string) {
    const brand = await this.prisma.brand.findFirst({
      where: { id, tenant_id: tenantId },
    });

    if (!brand) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Brand not found',
      });
    }

    return brand;
  }

  async createBrand(tenantId: string, userId: string, dto: CreateBrandDto) {
    const existing = await this.prisma.brand.findFirst({
      where: { tenant_id: tenantId, name: dto.name },
    });

    if (existing) {
      throw new ConflictException({
        code: ApiErrorCode.BAD_REQUEST,
        message: `Brand with name '${dto.name}' already exists in this shop`,
      });
    }

    const brand = await this.prisma.brand.create({
      data: {
        tenant_id: tenantId,
        name: dto.name,
        description: dto.description,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenant_id: tenantId,
        user_id: userId,
        action: 'CREATE_BRAND',
        entity_type: 'Brand',
        entity_id: brand.id,
        new_values: { name: brand.name },
      },
    });

    return brand;
  }

  async updateBrand(tenantId: string, userId: string, id: string, dto: UpdateBrandDto) {
    const brand = await this.getBrand(tenantId, id);

    const updated = await this.prisma.brand.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenant_id: tenantId,
        user_id: userId,
        action: 'UPDATE_BRAND',
        entity_type: 'Brand',
        entity_id: id,
        old_values: { name: brand.name },
        new_values: { name: updated.name },
      },
    });

    return updated;
  }

  async deleteBrand(tenantId: string, userId: string, id: string) {
    const brand = await this.getBrand(tenantId, id);

    await this.prisma.brand.delete({
      where: { id },
    });

    await this.prisma.auditLog.create({
      data: {
        tenant_id: tenantId,
        user_id: userId,
        action: 'DELETE_BRAND',
        entity_type: 'Brand',
        entity_id: id,
        old_values: { name: brand.name },
      },
    });

    return { success: true, message: 'Brand deleted successfully' };
  }

  // ================= UNITS & CONVERSIONS =================

  async listUnits(tenantId: string) {
    return this.prisma.unit.findMany({
      where: { tenant_id: tenantId },
      include: {
        conversions_from: {
          include: { to_unit: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createUnit(tenantId: string, userId: string, dto: CreateUnitDto) {
    const existing = await this.prisma.unit.findFirst({
      where: { tenant_id: tenantId, code: dto.code },
    });

    if (existing) {
      throw new ConflictException({
        code: ApiErrorCode.BAD_REQUEST,
        message: `Unit code '${dto.code}' already exists in this shop`,
      });
    }

    const unit = await this.prisma.unit.create({
      data: {
        tenant_id: tenantId,
        name: dto.name,
        code: dto.code,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenant_id: tenantId,
        user_id: userId,
        action: 'CREATE_UNIT',
        entity_type: 'Unit',
        entity_id: unit.id,
        new_values: { name: unit.name, code: unit.code },
      },
    });

    return unit;
  }

  async createConversion(tenantId: string, userId: string, dto: CreateUnitConversionDto) {
    if (dto.fromUnitId === dto.toUnitId) {
      throw new BadRequestException({
        code: ApiErrorCode.BAD_REQUEST,
        message: 'Cannot create unit conversion to the same unit',
      });
    }

    const [fromUnit, toUnit] = await Promise.all([
      this.prisma.unit.findFirst({
        where: { id: dto.fromUnitId, tenant_id: tenantId },
      }),
      this.prisma.unit.findFirst({
        where: { id: dto.toUnitId, tenant_id: tenantId },
      }),
    ]);

    if (!fromUnit || !toUnit) {
      throw new BadRequestException({
        code: ApiErrorCode.BAD_REQUEST,
        message: 'One or both units not found in this shop',
      });
    }

    const conversion = await this.prisma.unitConversion.upsert({
      where: {
        tenant_id_from_unit_id_to_unit_id: {
          tenant_id: tenantId,
          from_unit_id: dto.fromUnitId,
          to_unit_id: dto.toUnitId,
        },
      },
      create: {
        tenant_id: tenantId,
        from_unit_id: dto.fromUnitId,
        to_unit_id: dto.toUnitId,
        multiplier: dto.multiplier,
      },
      update: {
        multiplier: dto.multiplier,
      },
      include: {
        from_unit: true,
        to_unit: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenant_id: tenantId,
        user_id: userId,
        action: 'UPSERT_UNIT_CONVERSION',
        entity_type: 'UnitConversion',
        entity_id: conversion.id,
        new_values: { multiplier: dto.multiplier },
      },
    });

    return conversion;
  }

  // ================= PRODUCTS =================

  async listProducts(tenantId: string, query: ProductQueryInput) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      tenant_id: tenantId,
      ...(query.categoryId ? { category_id: query.categoryId } : {}),
      ...(query.brandId ? { brand_id: query.brandId } : {}),
      ...(query.isActive !== undefined ? { is_active: query.isActive } : {}),
    };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
        { barcode: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          category: true,
          brand: true,
          unit: true,
          variants: { where: { is_active: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        description: p.description,
        costPricePaisa: Number(p.cost_price),
        sellingPricePaisa: Number(p.selling_price),
        mrpPaisa: p.mrp ? Number(p.mrp) : null,
        vatRatePercent: Number(p.vat_rate_percent),
        reorderLevel: Number(p.reorder_level),
        imageUrl: p.image_url,
        isActive: p.is_active,
        category: p.category ? { id: p.category.id, name: p.category.name } : null,
        brand: p.brand ? { id: p.brand.id, name: p.brand.name } : null,
        unit: { id: p.unit.id, name: p.unit.name, code: p.unit.code },
        variantsCount: p.variants.length,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getProduct(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenant_id: tenantId },
      include: {
        category: true,
        brand: true,
        unit: true,
        variants: true,
        price_history: {
          orderBy: { created_at: 'desc' },
          take: 10,
        },
      },
    });

    if (!product) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Product not found',
      });
    }

    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      description: product.description,
      costPricePaisa: Number(product.cost_price),
      sellingPricePaisa: Number(product.selling_price),
      mrpPaisa: product.mrp ? Number(product.mrp) : null,
      vatRatePercent: Number(product.vat_rate_percent),
      reorderLevel: Number(product.reorder_level),
      imageUrl: product.image_url,
      isActive: product.is_active,
      category: product.category ? { id: product.category.id, name: product.category.name } : null,
      brand: product.brand ? { id: product.brand.id, name: product.brand.name } : null,
      unit: {
        id: product.unit.id,
        name: product.unit.name,
        code: product.unit.code,
      },
      variants: product.variants.map((v) => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        barcode: v.barcode,
        costPricePaisa: v.cost_price ? Number(v.cost_price) : null,
        sellingPricePaisa: v.selling_price ? Number(v.selling_price) : null,
        attributes: v.attributes,
        isActive: v.is_active,
      })),
      priceHistory: product.price_history.map((ph) => ({
        id: ph.id,
        oldCostPricePaisa: Number(ph.old_cost_price),
        newCostPricePaisa: Number(ph.new_cost_price),
        oldSellingPricePaisa: Number(ph.old_selling_price),
        newSellingPricePaisa: Number(ph.new_selling_price),
        changeReason: ph.change_reason,
        createdAt: ph.created_at,
      })),
      createdAt: product.created_at,
      updatedAt: product.updated_at,
    };
  }

  async createProduct(tenantId: string, userId: string, dto: CreateProductDto) {
    const existingSku = await this.prisma.product.findFirst({
      where: { tenant_id: tenantId, sku: dto.sku },
    });

    if (existingSku) {
      throw new ConflictException({
        code: ApiErrorCode.BAD_REQUEST,
        message: `Product with SKU '${dto.sku}' already exists in this shop`,
      });
    }

    const unit = await this.prisma.unit.findFirst({
      where: { id: dto.unitId, tenant_id: tenantId },
    });
    if (!unit) {
      throw new BadRequestException({
        code: ApiErrorCode.BAD_REQUEST,
        message: 'Specified unit not found in this shop',
      });
    }

    if (dto.categoryId) {
      const cat = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, tenant_id: tenantId },
      });
      if (!cat) {
        throw new BadRequestException({
          code: ApiErrorCode.BAD_REQUEST,
          message: 'Specified category not found in this shop',
        });
      }
    }

    if (dto.brandId) {
      const br = await this.prisma.brand.findFirst({
        where: { id: dto.brandId, tenant_id: tenantId },
      });
      if (!br) {
        throw new BadRequestException({
          code: ApiErrorCode.BAD_REQUEST,
          message: 'Specified brand not found in this shop',
        });
      }
    }

    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          tenant_id: tenantId,
          name: dto.name,
          sku: dto.sku,
          barcode: dto.barcode,
          description: dto.description,
          category_id: dto.categoryId,
          brand_id: dto.brandId,
          unit_id: dto.unitId,
          cost_price: BigInt(dto.costPricePaisa),
          selling_price: BigInt(dto.sellingPricePaisa),
          mrp: dto.mrpPaisa ? BigInt(dto.mrpPaisa) : null,
          vat_rate_percent: dto.vatRatePercent,
          reorder_level: dto.reorderLevel,
          image_url: dto.imageUrl,
          is_active: dto.isActive,
        },
      });

      // Record initial price entry
      await tx.priceHistory.create({
        data: {
          tenant_id: tenantId,
          product_id: created.id,
          old_cost_price: BigInt(dto.costPricePaisa),
          new_cost_price: BigInt(dto.costPricePaisa),
          old_selling_price: BigInt(dto.sellingPricePaisa),
          new_selling_price: BigInt(dto.sellingPricePaisa),
          change_reason: 'Initial Product Creation',
          changed_by: userId,
        },
      });

      await tx.auditLog.create({
        data: {
          tenant_id: tenantId,
          user_id: userId,
          action: 'CREATE_PRODUCT',
          entity_type: 'Product',
          entity_id: created.id,
          new_values: { name: created.name, sku: created.sku },
        },
      });

      return created;
    });

    return this.getProduct(tenantId, product.id);
  }

  async updateProduct(tenantId: string, userId: string, id: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenant_id: tenantId },
    });

    if (!product) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Product not found',
      });
    }

    if (dto.sku && dto.sku !== product.sku) {
      const skuExists = await this.prisma.product.findFirst({
        where: { tenant_id: tenantId, sku: dto.sku, NOT: { id } },
      });
      if (skuExists) {
        throw new ConflictException({
          code: ApiErrorCode.BAD_REQUEST,
          message: `SKU '${dto.sku}' already exists in this shop`,
        });
      }
    }

    const priceChanged =
      (dto.costPricePaisa !== undefined && BigInt(dto.costPricePaisa) !== product.cost_price) ||
      (dto.sellingPricePaisa !== undefined &&
        BigInt(dto.sellingPricePaisa) !== product.selling_price);

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.sku !== undefined ? { sku: dto.sku } : {}),
          ...(dto.barcode !== undefined ? { barcode: dto.barcode } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.categoryId !== undefined ? { category_id: dto.categoryId } : {}),
          ...(dto.brandId !== undefined ? { brand_id: dto.brandId } : {}),
          ...(dto.unitId !== undefined ? { unit_id: dto.unitId } : {}),
          ...(dto.costPricePaisa !== undefined ? { cost_price: BigInt(dto.costPricePaisa) } : {}),
          ...(dto.sellingPricePaisa !== undefined
            ? { selling_price: BigInt(dto.sellingPricePaisa) }
            : {}),
          ...(dto.mrpPaisa !== undefined
            ? { mrp: dto.mrpPaisa ? BigInt(dto.mrpPaisa) : null }
            : {}),
          ...(dto.vatRatePercent !== undefined ? { vat_rate_percent: dto.vatRatePercent } : {}),
          ...(dto.reorderLevel !== undefined ? { reorder_level: dto.reorderLevel } : {}),
          ...(dto.imageUrl !== undefined ? { image_url: dto.imageUrl } : {}),
          ...(dto.isActive !== undefined ? { is_active: dto.isActive } : {}),
        },
      });

      if (priceChanged) {
        await tx.priceHistory.create({
          data: {
            tenant_id: tenantId,
            product_id: id,
            old_cost_price: product.cost_price,
            new_cost_price: updated.cost_price,
            old_selling_price: product.selling_price,
            new_selling_price: updated.selling_price,
            change_reason: dto.priceChangeReason || 'Price update',
            changed_by: userId,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          tenant_id: tenantId,
          user_id: userId,
          action: 'UPDATE_PRODUCT',
          entity_type: 'Product',
          entity_id: id,
          old_values: { name: product.name, sku: product.sku },
          new_values: { name: updated.name, sku: updated.sku },
        },
      });
    });

    return this.getProduct(tenantId, id);
  }

  async deleteProduct(tenantId: string, userId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenant_id: tenantId },
    });

    if (!product) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Product not found',
      });
    }

    // Soft delete
    await this.prisma.product.update({
      where: { id },
      data: { is_active: false },
    });

    await this.prisma.auditLog.create({
      data: {
        tenant_id: tenantId,
        user_id: userId,
        action: 'SOFT_DELETE_PRODUCT',
        entity_type: 'Product',
        entity_id: id,
      },
    });

    return { success: true, message: 'Product deactivated successfully' };
  }

  async getPriceHistory(tenantId: string, productId: string) {
    await this.getProduct(tenantId, productId);

    const history = await this.prisma.priceHistory.findMany({
      where: { product_id: productId, tenant_id: tenantId },
      orderBy: { created_at: 'desc' },
    });

    return history.map((ph) => ({
      id: ph.id,
      oldCostPricePaisa: Number(ph.old_cost_price),
      newCostPricePaisa: Number(ph.new_cost_price),
      oldSellingPricePaisa: Number(ph.old_selling_price),
      newSellingPricePaisa: Number(ph.new_selling_price),
      changeReason: ph.change_reason,
      createdAt: ph.created_at,
    }));
  }

  async setProductImage(tenantId: string, userId: string, productId: string, imageUrl: string) {
    await this.getProduct(tenantId, productId);

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: { image_url: imageUrl },
    });

    await this.prisma.auditLog.create({
      data: {
        tenant_id: tenantId,
        user_id: userId,
        action: 'UPDATE_PRODUCT_IMAGE',
        entity_type: 'Product',
        entity_id: productId,
        new_values: { imageUrl },
      },
    });

    return { id: updated.id, imageUrl: updated.image_url };
  }

  // ================= VARIANTS (P1) =================

  async addVariant(tenantId: string, productId: string, dto: CreateVariantDto) {
    await this.getProduct(tenantId, productId);

    const existingSku = await this.prisma.productVariant.findFirst({
      where: { tenant_id: tenantId, sku: dto.sku },
    });

    if (existingSku) {
      throw new ConflictException({
        code: ApiErrorCode.BAD_REQUEST,
        message: `Variant SKU '${dto.sku}' already exists in this shop`,
      });
    }

    const variant = await this.prisma.productVariant.create({
      data: {
        tenant_id: tenantId,
        product_id: productId,
        name: dto.name,
        sku: dto.sku,
        barcode: dto.barcode,
        cost_price: dto.costPricePaisa ? BigInt(dto.costPricePaisa) : null,
        selling_price: dto.sellingPricePaisa ? BigInt(dto.sellingPricePaisa) : null,
        attributes: dto.attributes,
        is_active: dto.isActive,
      },
    });

    return {
      id: variant.id,
      productId: variant.product_id,
      name: variant.name,
      sku: variant.sku,
      barcode: variant.barcode,
      costPricePaisa: variant.cost_price ? Number(variant.cost_price) : null,
      sellingPricePaisa: variant.selling_price ? Number(variant.selling_price) : null,
      attributes: variant.attributes,
      isActive: variant.is_active,
    };
  }

  async listVariants(tenantId: string, productId: string) {
    await this.getProduct(tenantId, productId);

    const variants = await this.prisma.productVariant.findMany({
      where: { product_id: productId, tenant_id: tenantId },
      orderBy: { name: 'asc' },
    });

    return variants.map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku,
      barcode: v.barcode,
      costPricePaisa: v.cost_price ? Number(v.cost_price) : null,
      sellingPricePaisa: v.selling_price ? Number(v.selling_price) : null,
      attributes: v.attributes,
      isActive: v.is_active,
    }));
  }
}
