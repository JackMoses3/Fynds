/* eslint-disable */
import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductImage, ProductItem } from '../../generated/prisma';
import { DatabaseService } from '../database/database.service';
import { ProductItemTransferDto } from './dto/product-item.dto';
import { Filters } from './dto/filter.dto';
import { RecommendationService } from '../recommendation/recommendation.service';
import { QdrantService } from '../qdrant/qdrant.service';
import NodeCache from 'node-cache';

@Injectable()
export class ProductItemService {
  private readonly cache = new NodeCache({ stdTTL: 300 }); // Cache with 5-minute TTL

  constructor(
    private readonly db: DatabaseService,
    private readonly recommendationService: RecommendationService,
    private readonly qdrantService: QdrantService,
  ) {}

  async getUniqueBrands(filters?: {
    category?: string[];
    retailer?: string[];
  }): Promise<string[]> {
    const cacheKey = `brands:${JSON.stringify(filters)}`;
    const cachedBrands = this.cache.get<string[]>(cacheKey);
    if (cachedBrands) {
      return cachedBrands;
    }

    const where: any = {};
    if (filters?.category?.length) where.category = { in: filters.category };
    if (filters?.retailer?.length) where.retailer = { in: filters.retailer };

    const rows = await this.db.productItem.findMany({
      where,
      distinct: ['brand'],
      select: { brand: true },
    });
    const brands = rows.map((r) => r.brand!).filter(Boolean);

    this.cache.set(cacheKey, brands);
    return brands;
  }

  /** Get distinct retailers */
  async getUniqueRetailers(filters?: {
    brand?: string[];
    category?: string[];
  }): Promise<string[]> {
    const cacheKey = `retailers:${JSON.stringify(filters)}`;
    const cachedRetailers = this.cache.get<string[]>(cacheKey);
    if (cachedRetailers) {
      return cachedRetailers;
    }

    const where: any = {};
    if (filters?.brand?.length) where.brand = { in: filters.brand };
    if (filters?.category?.length) where.category = { in: filters.category };

    const rows = await this.db.productItem.findMany({
      where,
      distinct: ['retailer'],
      select: { retailer: true },
    });
    const retailers = rows.map((r) => r.retailer!).filter(Boolean);

    this.cache.set(cacheKey, retailers);
    return retailers;
  }

  /** Get distinct categories */
  async getUniqueCategories(filters?: {
    brand?: string[];
    retailer?: string[];
  }): Promise<string[]> {
    const cacheKey = `categories:${JSON.stringify(filters)}`;
    const cachedCategories = this.cache.get<string[]>(cacheKey);
    if (cachedCategories) {
      return cachedCategories;
    }

    const where: any = {};
    if (filters?.brand?.length) where.brand = { in: filters.brand };
    if (filters?.retailer?.length) where.retailer = { in: filters.retailer };

    const rows = await this.db.productItem.findMany({
      where,
      distinct: ['category'],
      select: { category: true },
    });
    const categories = rows.map((r) => r.category!).filter(Boolean);

    this.cache.set(cacheKey, categories);
    return categories;
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
      select: {
        id: true,
        name: true,
        brand: true,
        retailer: true,
        price: true,
        url: true,
        productImages: {
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

  /**
   * Utility method for getting a list of products based on different criteria:
   * e.g. styles, retailers, brands, categories. and making sure they return with the product Item transfer DtO
   */
  async getProductsWithFilters(
    userId: number,
    filters: Filters,
    limit: number,
  ): Promise<ProductItemTransferDto[]> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { clothingPreferences: true },
    });

    const whereClause: any = {
      AND: [
        // Base filters that always apply
        {
          price: {
            gte: filters.minPrice ?? 0,
            lte: filters.maxPrice ?? Infinity,
          },
        },
        {
          embedding: {
            not: { in: [null, 'skip'] },
          },
        },
        {
          category: {
            not: 'uncategorized',
          },
        },
      ],
    };

    // Add conditional filters to the AND array
    if (filters.brands?.length) {
      whereClause.AND.push({ brand: { in: filters.brands } });
    }

    if (filters.categories?.length) {
      whereClause.AND.push({ category: { in: filters.categories } });
    }

    if (filters.retailers?.length) {
      whereClause.AND.push({ retailer: { in: filters.retailers } });
    }

    if (filters.sex?.length) {
      // If gender filters are provided, use them (overrides user preference)
      whereClause.AND.push({ sex: { in: filters.sex } });
    } else if (user?.clothingPreferences) {
      // If no gender filters but user has clothing preferences, use those
      whereClause.AND.push({ sex: user.clothingPreferences });
    }

    if (filters.styles?.length) {
      whereClause.AND.push({
        productStyles: {
          some: {
            styleId: { in: filters.styles },
          },
        },
      });
    }

    const products = await this.db.productItem.findMany({
      where: whereClause,
      include: {
        productImages: {
          orderBy: { id: 'asc' },
        },
      },
      take: limit,
    });

    return products.map(
      (p): ProductItemTransferDto => ({
        id: p.id,
        name: p.name || '',
        brand: p.brand || '',
        retailer: p.retailer || '',
        price: p.price || 0,
        url: p.url || '',
        images: p.productImages.map((img) => ({
          id: img.id,
          imageUrl: img.imageUrl,
        })),
      }),
    );
  }
}
