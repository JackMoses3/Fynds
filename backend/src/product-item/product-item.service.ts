/* eslint-disable */
import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductImage, ProductItem } from '../../generated/prisma';
import { DatabaseService } from '../database/database.service';
import { ProductItemTransferDto } from './dto/product-item.dto';
import { FilterProductItemDto } from './dto/filter.dto';
import { RecommendationService } from '../recommendation/recommendation.service';
import { QdrantService } from '../qdrant/qdrant.service';

@Injectable()
export class ProductItemService {
  constructor(
    private readonly db: DatabaseService,
    private readonly recommendationService: RecommendationService,
    private readonly qdrantService: QdrantService, // Add this line
  ) {}

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
    userId?: number,
  ): Promise<ProductItemTransferDto[]> {
    console.log(
      '🔍 Starting personalized filtered product search for user:',
      userId,
      'filters:',
      JSON.stringify(filters, null, 2),
    );

    // Build filter conditions
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
      // Check if any PRODUCTS (not scores) match the filters
      const count = await this.db.productItem.count({ where });

      if (count === 0) {
        console.log('⚠️ No products match the filters');
        return [];
      }

      // New personalization logic
      if (userId) {
        console.log('👤 User ID found, fetching personalized products');
        return this.recommendationService.getPersonalizedFilteredProductsForUser(
          userId,
          where,
        );
      } else {
        console.log('👤 No user ID found, fetching non-personalized products');
        // Get an empty sex filter since we don't have a user
        const sexFilter = {};
        return this.getNonPersonalizedFilteredProducts(where, sexFilter);
      }
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`❌ Database query failed after ${totalTime}ms:`, error);
      throw error;
    }
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

  /** Get recommended products for a user */
  async getRecommendedProducts(
    userId: number,
  ): Promise<ProductItemTransferDto[]> {
    return this.recommendationService.getRecommendedProductsForUser(userId);
  }

  // Extract current implementation into separate method
  private async getNonPersonalizedFilteredProducts(
    filterWhere: any,
    sexFilter: any = {}, // Make it optional to maintain backward compatibility
  ): Promise<ProductItemTransferDto[]> {
    // Apply sex filter, filter criteria, and basic quality filters
    const combinedWhere = {
      ...filterWhere,
      ...sexFilter,
      embedding: { not: null },
      category: { not: 'Uncategorized' },
    };

    const items = await this.db.productItem.findMany({
      where: combinedWhere,
      take: 50,
      include: {
        productImages: {
          orderBy: { id: 'asc' },
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
}
