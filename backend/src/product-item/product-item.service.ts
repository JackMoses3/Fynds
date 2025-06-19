/* eslint-disable */
import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductImage, ProductItem } from '../../generated/prisma';
import { DatabaseService } from '../database/database.service';
import { ProductItemTransferDto } from './dto/product-item.dto';
import { FilterProductItemDto } from './dto/filter.dto';

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
  ): Promise<ProductItemTransferDto[]> {
    console.log(
      '🔍 Starting filtered product search with filters:',
      JSON.stringify(filters, null, 2),
    );

    const startTime = Date.now();
    const where: any = {};

    // Handle both singular and plural forms from frontend
    const brands = filters.brands || filters.brand;
    const retailers = filters.retailers || filters.retailer; // <- Add this line
    const categories = filters.categories || filters.category;

    if (brands?.length) {
      where.brand = { in: brands };
      console.log('🏷️ Brand filter applied:', brands);
    }

    if (retailers?.length) {
      // <- Use the normalized variable
      where.retailer = { in: retailers };
      console.log('🏪 Retailer filter applied:', retailers);
    }

    if (categories?.length) {
      where.category = { in: categories };
      console.log('📂 Category filter applied:', categories);
    }

    if (typeof filters.minPrice === 'number') {
      where.price = { ...(where.price || {}), gte: filters.minPrice };
      console.log('💰 Min price filter applied:', filters.minPrice);
    }

    if (typeof filters.maxPrice === 'number') {
      where.price = { ...(where.price || {}), lte: filters.maxPrice };
      console.log('💰 Max price filter applied:', filters.maxPrice);
    }

    console.log('🔍 Final where clause:', JSON.stringify(where, null, 2));

    try {
      // Add a simple count query first to see if it's fast
      const countStart = Date.now();
      const count = await this.db.productItem.count({ where });
      const countTime = Date.now() - countStart;
      console.log(
        `📊 Found ${count} matching products (count took ${countTime}ms)`,
      );

      if (count === 0) {
        console.log('⚠️ No products match the filters');
        return [];
      }

      // Now do the full query with all images
      const queryStart = Date.now();
      const items = await this.db.productItem.findMany({
        where,
        take: 50, // Limit to 50 results for now
        select: {
          id: true,
          name: true,
          brand: true,
          retailer: true,
          price: true,
          url: true,
          productImages: {
            orderBy: { id: 'asc' },
            // Remove the take: 1 limit to get all images
            select: { id: true, imageUrl: true },
          },
        },
      });

      const queryTime = Date.now() - queryStart;
      const totalTime = Date.now() - startTime;

      console.log(
        `✅ Query executed in ${queryTime}ms, total time: ${totalTime}ms`,
      );
      console.log(`📦 Returning ${items.length} products`);

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
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`❌ Database query failed after ${totalTime}ms:`, error);
      throw error;
    }
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

  async findManyByIds(ids: number[]) {
    const items = await this.db.productItem.findMany({
      where: { id: { in: ids } },
      include: {
        productImages: true,
        productStyles: { include: { style: true } },
      },
    });

    // Map to transfer format (images, not productImages)
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
      style: p.productStyles?.map((s) => s.style?.name) ?? [],
    }));
  }
}
