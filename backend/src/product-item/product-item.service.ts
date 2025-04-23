// src/product-item/product-item.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductItem, ProductImage } from '@prisma/client';
import { DatabaseService } from '../database/database.service';

interface CreateProductInput
  extends Omit<Prisma.ProductItemCreateInput, 'productImages'> {
  imageUrls: string[];
}

@Injectable()
export class ProductItemService {
  constructor(private readonly db: DatabaseService) { }

  /**
   * Create a new product along with its images, returning images sorted by ID.
   */
  async createProductWithImages(
    data: CreateProductInput
  ): Promise<ProductItem & { productImages: ProductImage[] }> {
    const { imageUrls, ...payload } = data;
    return this.db.productItem.create({
      data: {
        ...payload,
        productImages: {
          create: imageUrls.map((url) => ({ imageUrl: url })),
        },
      },
      include: {
        productImages: {
          orderBy: { id: 'asc' },
        },
      },
    });
  }

  /**
   * Fetch a single product by ID, including its images sorted by ID.
   */
  async findById(
    id: number
  ): Promise<(ProductItem & { productImages: ProductImage[] }) | null> {
    return this.db.productItem.findUnique({
      where: { id },
      include: {
        productImages: {
          orderBy: { id: 'asc' },
        },
      },
    });
  }

  /**
   * Fetch a random product, including images sorted by ID.
   */
  async getRandomProduct(): Promise<ProductItem & { productImages: ProductImage[] }> {
    const count = await this.db.productItem.count();
    if (count === 0) {
      throw new NotFoundException('No products in database');
    }
    const randomIndex = Math.floor(Math.random() * count);
    const [randomProduct] = await this.db.productItem.findMany({
      skip: randomIndex,
      take: 1,
      include: {
        productImages: {
          orderBy: { id: 'asc' },
        },
      },
    });
    return randomProduct;
  }

  
  /**
   * Fetch a random product matching the given filters, including images sorted by ID.
   */
  async getRandomProductWithFilters(filters: {
    brand?: string[];
    retailer?: string[];
    category?: string[];
    minPrice?: number;
    maxPrice?: number;
  }): Promise<(ProductItem & { productImages: ProductImage[] }) | null> {
    const where: any = {};
    if (filters.brand?.length) where.brand = { in: filters.brand };
    if (filters.retailer?.length) where.retailer = { in: filters.retailer };
    if (filters.category?.length) where.category = { in: filters.category };
    if (typeof filters.minPrice === 'number') {
      where.price = { ...(where.price || {}), gte: filters.minPrice };
    }
    if (typeof filters.maxPrice === 'number') {
      where.price = { ...(where.price || {}), lte: filters.maxPrice };
    }

    const count = await this.db.productItem.count({ where });
    if (count === 0) return null;

    const randomIndex = Math.floor(Math.random() * count);
    const [randomProduct] = await this.db.productItem.findMany({
      skip: randomIndex,
      take: 1,
      where,
      include: {
        productImages: {
          orderBy: { id: 'asc' },
        },
      },
    });
    return randomProduct;
  }

  /**
   * Return all distinct categories, optionally filtered by brand/retailer. Used for filters
   */
  async getUniqueCategories(filters?: {
    brand?: string[];
    retailer?: string[];
  }): Promise<string[]> {
    const where: any = {};
    if (filters?.brand?.length) where.brand = { in: filters.brand };
    if (filters?.retailer?.length) where.retailer = { in: filters.retailer };

    const rows = await this.db.productItem.findMany({
      where,
      distinct: ['category'], //groups by distinct category
      select: { category: true },
    });
    return rows.map((r) => r.category!).filter(Boolean);
  }

  /**
   * Return all distinct brands, optionally filtered by retailer/category.
   */
  async getUniqueBrands(filters?: {
    retailer?: string[];
    category?: string[];
  }): Promise<string[]> {
    const where: any = {};
    if (filters?.retailer?.length) where.retailer = { in: filters.retailer };
    if (filters?.category?.length) where.category = { in: filters.category };

    const rows = await this.db.productItem.findMany({
      where,
      distinct: ['brand'],
      select: { brand: true },
    });
    return rows.map((r) => r.brand!).filter(Boolean);
  }

  /**
   * Return all distinct retailers, optionally filtered by brand/category.
   */
  async getUniqueRetailers(filters?: {
    brand?: string[];
    category?: string[];
  }): Promise<string[]> {
    const where: any = {};
    if (filters?.brand?.length) where.brand = { in: filters.brand };
    if (filters?.category?.length) where.category = { in: filters.category };

    const rows = await this.db.productItem.findMany({
      where,
      distinct: ['retailer'],
      select: { retailer: true },
    });
    return rows.map((r) => r.retailer!).filter(Boolean);
  }
}
