/* eslint-disable */
import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductImage, ProductItem } from '../../generated/prisma';
import { DatabaseService } from '../database/database.service';
import { ProductItemTransferDto } from './dto/product-item.dto';
import { FilterProductItemDto } from './dto/filter-product-item.dto';

@Injectable()
export class ProductItemService {
  constructor(private readonly db: DatabaseService) {}

  async getUniqueBrands(filters?: {
    category?: string[];
    retailer?: string[];
  }): Promise<string[]> {
    const where: any = {};
    if (filters?.category?.length) where.category = { in: filters.category };
    if (filters?.retailer?.length) where.retailer = { in: filters.retailer };

    const rows = await this.db.productItem.findMany({
      where,
      distinct: ['brand'],
      select: { brand: true },
    });
    return rows.map((r) => r.brand!).filter(Boolean);
  }

  /** Get distinct retailers */
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

  /** Get distinct categories */
  async getUniqueCategories(filters?: {
    brand?: string[];
    retailer?: string[];
  }): Promise<string[]> {
    const where: any = {};
    if (filters?.brand?.length) where.brand = { in: filters.brand };
    if (filters?.retailer?.length) where.retailer = { in: filters.retailer };

    const rows = await this.db.productItem.findMany({
      where,
      distinct: ['category'],
      select: { category: true },
    });
    return rows.map((r) => r.category!).filter(Boolean);
  }

  /** Fetch all products (no filters) */
  async getProductItems(): Promise<ProductItemTransferDto[]> {
    const items = await this.db.productItem.findMany({
      select: {
        id: true,
        name: true,
        brand: true,
        retailer: true,
        price: true,
        url: true,
        productImages: {
          orderBy: { id: 'asc' },
          select: { id: true, imageUrl: true },
        },
      },
    });

    return items.map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      retailer: p.retailer,
      price: p.price,
      url: p.url,
      images: p.productImages.map((img) => ({
        id: img.id,
        imageUrl: img.imageUrl,
      })),
    }));
  }

  /** Fetch products by arbitrary filters */
  async getFilteredProductItems(
    filters: FilterProductItemDto,
  ): Promise<ProductItemTransferDto[] | null> {
    const where: any = {};
    if (filters.brands?.length) where.brand = { in: filters.brands };
    if (filters.retailers?.length) where.retailer = { in: filters.retailers };
    if (filters.categories?.length) where.category = { in: filters.categories };
    if (typeof filters.minPrice === 'number') {
      where.price = { ...(where.price || {}), gte: filters.minPrice };
    }
    if (typeof filters.maxPrice === 'number') {
      where.price = { ...(where.price || {}), lte: filters.maxPrice };
    }

    const items = await this.db.productItem.findMany({
      where,
      select: {
        id: true,
        name: true,
        brand: true,
        retailer: true,
        price: true,
        url: true,
        productImages: {
          orderBy: { id: 'asc' },
          select: { id: true, imageUrl: true },
        },
      },
    });

    if (!items.length) return null;

    return items.map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      retailer: p.retailer,
      price: p.price,
      url: p.url,
      images: p.productImages.map((img) => ({
        id: img.id,
        imageUrl: img.imageUrl,
      })),
    }));
  }

  /** Fetch a random “page” of 10 products */
  async getRandomProducts(): Promise<ProductItemTransferDto[]> {
    const count = await this.db.productItem.count();
    if (count === 0) {
      throw new NotFoundException('No products in database');
    }
    const skip = Math.floor(Math.random() * count);

    const items = await this.db.productItem.findMany({
      skip,
      take: 10,
      select: {
        id: true,
        name: true,
        brand: true,
        retailer: true,
        price: true,
        url: true,
        productImages: {
          orderBy: { id: 'asc' },
          select: { id: true, imageUrl: true },
        },
      },
    });

    return items.map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      retailer: p.retailer,
      price: p.price,
      url: p.url,
      images: p.productImages.map((img) => ({
        id: img.id,
        imageUrl: img.imageUrl,
      })),
    }));
  }

  /** Lookup a single product (with its images) */
  async findById(
    id: number,
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
}
