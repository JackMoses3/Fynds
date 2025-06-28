import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { QdrantService } from '../qdrant/qdrant.service';
import { ProductItemTransferDto } from '../product-item/dto/product-item.dto';

@Injectable()
export class RecommendationService {
  constructor(
    private readonly db: DatabaseService,
    private readonly qdrantService: QdrantService,
  ) {}

  // HELPER METHODS

  /**
   * Normalizes frontend filters to database query format
   */
  private normalizeFiltersForDatabase(filterWhere: any): any {
    const normalized: any = {};
    this.pushStringArrayCondition(
      normalized,
      'retailer',
      this.extractFilterValues(filterWhere.retailer),
      'prisma',
    );
    this.pushStringArrayCondition(
      normalized,
      'brand',
      this.extractFilterValues(filterWhere.brand),
      'prisma',
    );
    this.pushStringArrayCondition(
      normalized,
      'category',
      this.extractFilterValues(filterWhere.category),
      'prisma',
    );
    const price = this.extractPriceRangeCondition(
      filterWhere.minPrice,
      filterWhere.maxPrice,
      'prisma',
    );
    if (price) normalized.price = price;
    return normalized;
  }

  /**
   * Counts the number of active filters to determine optimization strategy
   */
  private countActiveFilters(qdrantFilter: any): number {
    if (!qdrantFilter?.must) return 0;
    return qdrantFilter.must.length;
  }

  /**
   * Gets recently viewed product IDs for a user
   */
  private async getRecentlyViewedProductIds(
    userId: number,
    take: number = 100,
  ): Promise<Set<number>> {
    const recentViewed = await this.db.viewingHistory.findMany({
      where: { userId },
      orderBy: { id: 'desc' },
      take,
      select: { productItemId: true },
    });
    return new Set(recentViewed.map((v) => v.productItemId));
  }

  /**
   * Maps product database entities to DTOs
   */
  private mapProductsToDto(products: any[]): ProductItemTransferDto[] {
    return products.map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      retailer: p.retailer,
      price: p.price,
      url: p.url,
      images: p.productImages.map((img: { id: any; imageUrl: any }) => ({
        id: img.id,
        imageUrl: img.imageUrl,
      })),
    }));
  }

  /**
   * Gets non-personalized products with fallback logic
   */
  private async getNonPersonalizedFilteredProducts(
    filterWhere: any,
    sexFilter: any,
    viewedIds: Set<number> = new Set(),
    limit = 50,
  ): Promise<ProductItemTransferDto[]> {
    // Apply filters with quality constraints
    const combinedWhere = {
      ...filterWhere,
      ...sexFilter,
      embedding: { not: null },
      category: { not: 'Uncategorized' },
      ...(viewedIds.size > 0 ? { id: { notIn: Array.from(viewedIds) } } : {}),
    };

    const items = await this.db.productItem.findMany({
      where: combinedWhere,
      take: limit,
      include: {
        productImages: {
          orderBy: { id: 'asc' },
        },
      },
    });

    return this.mapProductsToDto(items);
  }

  // MAIN METHODS - NOW USING HELPERS

  async getRecommendedProductsForUser(
    userId: number,
    limit = 20,
  ): Promise<ProductItemTransferDto[]> {
    if (!userId) {
      throw new Error('Cannot get recommendations: userId is undefined');
    }

    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error(`User with ID ${userId} not found in database`);
    }

    // 1. Get user clothing preference
    const sexFilter = await this.getSexFilterForUser(userId);

    // Check for onboarding scenario
    const onboardingProducts = await this.db.onboardingProduct.findMany({
      where: { userId },
      orderBy: { id: 'asc' },
      select: { productItemId: true },
    });

    // Count ProductScores for this user
    const productScoreCount = await this.db.productScore.count({
      where: { userId },
    });

    // If user just onboarded (only onboarding products in ProductScore)
    if (
      onboardingProducts.length > 0 &&
      productScoreCount === onboardingProducts.length
    ) {
      let onboardingMatches: number[] = [];
      if (onboardingProducts.length <= 7) {
        // Get 2 matches per onboarding product
        for (const onboarding of onboardingProducts) {
          const matches = await this.qdrantService.searchProduct({
            productId: onboarding.productItemId,
            searchDto: { top_k: 50 },
          });
          // Filter by sex and uniqueness
          const products = await this.db.productItem.findMany({
            where: {
              id: { in: matches.map((m) => m.id) },
              ...sexFilter,
            },
            select: { id: true },
          });
          onboardingMatches.push(...products.slice(0, 2).map((p) => p.id));
        }
      } else {
        // >8 onboarding products: 1 match per onboarding product
        for (const onboarding of onboardingProducts) {
          const matches = await this.qdrantService.searchProduct({
            productId: onboarding.productItemId,
            searchDto: { top_k: 50 },
          });
          const products = await this.db.productItem.findMany({
            where: {
              id: { in: matches.map((m) => m.id) },
              ...sexFilter,
            },
            select: { id: true },
          });
          if (products.length > 0) onboardingMatches.push(products[0].id);
        }
      }

      // Fill the rest with random products if needed
      let randomIds: number[] = [];
      if (onboardingMatches.length < limit) {
        const randomProducts = await this.db.productItem.findMany({
          where: {
            embedding: { not: null },
            category: { not: 'Uncategorized' },
            ...sexFilter,
          },
          orderBy: { id: 'asc' },
          take: 1000,
        });
        randomIds = this.shuffle(randomProducts.map((p) => p.id)).filter(
          (id) => !onboardingMatches.includes(id),
        );
      }

      const allIds = [...onboardingMatches, ...randomIds].slice(0, limit);
      const products = await this.db.productItem.findMany({
        where: { id: { in: allIds } },
        include: {
          productImages: {
            orderBy: { id: 'asc' }, // This ensures consistent ordering by ID
          },
        },
      });

      // Use helper function instead of duplicated code
      return this.mapProductsToDto(products);
    }

    // 2. Get 100 most recent ProductScores for user
    const recentScores = await this.db.productScore.findMany({
      where: { userId },
      orderBy: { id: 'desc' },
      take: 100,
    });

    // 3. Get 14 highest scores from those 100
    const topRecent = [...recentScores]
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 14);

    // 4. For each, use Qdrant to get 50 most similar products
    const qdrantResults: {
      [productId: number]: { id: number; distance: number }[];
    } = {};
    for (const score of topRecent) {
      qdrantResults[score.productItemId] =
        await this.qdrantService.searchProduct({
          productId: score.productItemId,
          searchDto: { top_k: 50 },
        });
    }

    // 5. Get user's 100 most recent ViewingHistory
    const recentViewed = await this.db.viewingHistory.findMany({
      where: { userId },
      orderBy: { id: 'desc' },
      take: 100,
      select: { productItemId: true },
    });
    const viewedIds = new Set(recentViewed.map((v) => v.productItemId));

    // 6. Select 1 per top score, ensuring 3 unique retailers and not in recent viewing
    const selectedRecent: number[] = [];
    const retailerSet = new Set<string>();
    for (const score of topRecent) {
      const candidates = qdrantResults[score.productItemId]
        .map((r) => r.id)
        .filter((id) => !viewedIds.has(id));
      if (candidates.length === 0) continue;
      // Fetch product info to check retailer and sex
      const products = await this.db.productItem.findMany({
        where: { id: { in: candidates }, ...sexFilter },
        select: { id: true, retailer: true, sex: true },
      });
      for (const p of products) {
        if (retailerSet.size < 3 && !retailerSet.has(p.retailer)) {
          retailerSet.add(p.retailer);
          selectedRecent.push(p.id);
          break;
        }
        if (selectedRecent.length < 14) {
          selectedRecent.push(p.id);
          break;
        }
      }
      if (selectedRecent.length >= 14) break;
    }

    // 7. 3 history: 3 highest scores from 100-1000 most recent
    const oldScores = await this.db.productScore.findMany({
      where: { userId },
      orderBy: { id: 'desc' },
      skip: 100,
      take: 900,
    });
    let topOld: number[] = [];
    if (oldScores.length > 0) {
      topOld = [...oldScores]
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 3)
        .map((s) => s.productItemId);
    }

    // --- Lower ProductScore by 40% for all seeds used and round to 2 decimals ---
    const seedProductIds = [
      ...topRecent.map((s) => s.productItemId),
      ...topOld,
    ];
    if (seedProductIds.length > 0) {
      // Fetch current scores
      const scores = await this.db.productScore.findMany({
        where: {
          userId,
          productItemId: { in: seedProductIds },
        },
        select: { id: true, score: true },
      });

      // Update each with rounded value
      for (const s of scores) {
        const newScore = Number(((s.score ?? 0) * 0.75).toFixed(2));
        await this.db.productScore.update({
          where: { id: s.id },
          data: { score: newScore },
        });
      }
    }

    // 8. 3 random: embedding not null, category != Uncategorized, sex matches
    const currentRetailers = new Set<string>();
    for (const id of [...selectedRecent, ...topOld]) {
      const product = await this.db.productItem.findUnique({
        where: { id },
        select: { retailer: true },
      });
      if (product?.retailer) currentRetailers.add(product.retailer);
    }

    const randomProducts = await this.db.productItem.findMany({
      where: {
        embedding: { not: null },
        category: { not: 'Uncategorized' },
        ...sexFilter,
        retailer: { notIn: Array.from(currentRetailers) },
      },
      take: 1000,
    });
    let randomIds = this.shuffle(randomProducts.map((p) => p.id));

    // If no history, allocate those 3 to random
    if (topOld.length === 0) {
      randomIds = randomIds.slice(0, 6); // 3 + 3
    } else {
      randomIds = randomIds.slice(0, 3);
    }

    // 9. Combine and fetch final product details
    const allIds = [...selectedRecent, ...topOld, ...randomIds].slice(0, limit);
    const products = await this.db.productItem.findMany({
      where: { id: { in: allIds } },
      include: {
        productImages: {
          orderBy: { id: 'asc' }, // This ensures consistent ordering by ID
        },
      },
    });

    // Use helper function instead of duplicated code
    return this.mapProductsToDto(products);
  }

  async getPersonalizedFilteredProductsForUser(
    userId: number,
    filterWhere: any,
    limit = 20,
  ): Promise<ProductItemTransferDto[]> {
    // If filters are empty ({}), fallback to recommended algorithm
    if (
      !filterWhere ||
      (Object.keys(filterWhere).length === 0 &&
        filterWhere.constructor === Object)
    ) {
      return this.getRecommendedProductsForUser(userId, limit);
    }
    // Add this line at the start to track total execution time
    const startTime = Date.now();
    const maxTimeMs = 30000;
    console.log(
      `🚀 Starting getPersonalizedFilteredProductsForUser for user ${userId} with limit ${limit}`,
    );

    // 1. Get user's preferences first
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    console.log(`✅ User fetched (${Date.now() - startTime}ms)`);

    // 2. Debug the incoming filterWhere object
    console.log(
      '🚨 RAW filterWhere object:',
      JSON.stringify(filterWhere, null, 2),
    );
    console.log('🚨 filterWhere.retailer type:', typeof filterWhere.retailer);
    console.log('🚨 filterWhere.retailer value:', filterWhere.retailer);
    console.log(
      '🚨 filterWhere.retailer?.length:',
      filterWhere.retailer?.length,
    );
    console.log(
      '🚨 Array.isArray(filterWhere.retailer):',
      Array.isArray(filterWhere.retailer),
    );

    // 3. Build Qdrant filter from user preferences and frontend filters
    const filterBuildStart = Date.now();
    const qdrantFilter = this.buildQdrantFilter(user, filterWhere);
    console.log(`✅ Qdrant filter built (${Date.now() - filterBuildStart}ms)`);
    console.log(
      '🔍 Generated Qdrant filter:',
      JSON.stringify(qdrantFilter, null, 2),
    );
    console.log('🔍 Filter input - retailer:', filterWhere.retailer);
    console.log('🔍 Filter input - brand:', filterWhere.brand);
    console.log('🔍 Filter input - category:', filterWhere.category);

    // 3. Get recently viewed items to exclude
    const viewedStart = Date.now();
    const recentViewed = await this.db.viewingHistory.findMany({
      where: { userId },
      orderBy: { id: 'desc' },
      take: 100,
      select: { productItemId: true },
    });
    const viewedIds = new Set(recentViewed.map((v) => v.productItemId));
    console.log(`✅ Viewed history fetched (${Date.now() - viewedStart}ms)`);

    // 4. Get user's top scored products as seeds
    const scoresStart = Date.now();
    let scores: any[] = [];
    if (filterWhere.category) {
      const categoryValues = this.extractFilterValues(filterWhere.category);
      if (categoryValues && categoryValues.length > 0) {
        scores = await this.db.productScore.findMany({
          where: {
            userId,
            productItemId: {
              in: (
                await this.db.productItem.findMany({
                  where: { category: { in: categoryValues } },
                  select: { id: true },
                })
              ).map((p) => p.id),
            },
          },
          orderBy: { score: 'desc' },
          take: 10,
        });
      }
    }
    if (scores.length === 0) {
      scores = await this.db.productScore.findMany({
        where: { userId },
        orderBy: { score: 'desc' },
        take: 10,
      });
    }
    console.log(
      `✅ Product scores fetched (${Date.now() - scoresStart}ms, found ${scores.length} seeds)`,
    );

    // 5. Use optimized Qdrant search with batching for performance
    const qdrantStart = Date.now();
    let personalizedProducts: ProductItemTransferDto[] = [];

    if (scores.length > 0) {
      const seedProductIds = scores.map((s) => s.productItemId);
      let allSimilarResults: Array<{
        id: number;
        score: number;
        payload: any;
      }> = [];

      // Optimize based on filter complexity
      const hasMultipleFilters = this.countActiveFilters(qdrantFilter) > 2;
      const maxSeeds = hasMultipleFilters ? 5 : seedProductIds.length; // Reduce seeds when many filters
      const batchSize = hasMultipleFilters ? 5 : 10; // Process in smaller batches when complex

      console.log(
        `🚀 Performance optimization: Using ${maxSeeds} seeds in batches of ${batchSize} (multiple filters: ${hasMultipleFilters})`,
      );

      // Qdrant batch search
      allSimilarResults = await this.searchQdrantInBatches(
        seedProductIds,
        qdrantFilter,
        viewedIds,
        limit,
        maxSeeds,
        batchSize,
        startTime,
        maxTimeMs,
      );
      console.log(
        `✅ All Qdrant searches completed (${Date.now() - qdrantStart}ms)`,
      );

      // Deduplicate and sort by score
      const dedupeStart = Date.now();
      const [topProductIds, uniqueProducts] = this.deduplicateQdrantResults(
        allSimilarResults,
        limit,
      );
      console.log(
        `✅ Deduplication completed (${Date.now() - dedupeStart}ms), final count: ${topProductIds.length}`,
      );

      // Only fetch images from database - everything else comes from Qdrant payload
      const dbFetchStart = Date.now();
      const products = await this.db.productItem.findMany({
        where: { id: { in: topProductIds } },
        select: {
          id: true,
          name: true,
          url: true,
          productImages: {
            orderBy: { id: 'asc' },
            select: { id: true, imageUrl: true },
          },
        },
      });
      console.log(
        `✅ Database images fetched (${Date.now() - dbFetchStart}ms)`,
      );

      // Transform to DTOs using mostly Qdrant payload data
      const transformStart = Date.now();
      personalizedProducts = topProductIds.map((id) => {
        const product = products.find((p) => p.id === id);
        const qdrantData = uniqueProducts.get(id)!;

        return {
          id,
          name: product?.name || 'Unknown',
          brand: qdrantData.payload.brand?.[0] || 'Unknown',
          retailer: qdrantData.payload.retailer?.[0] || 'Unknown',
          price: qdrantData.payload.price || 0,
          url: product?.url || '',
          images:
            product?.productImages?.map((img) => ({
              id: img.id,
              imageUrl: img.imageUrl,
            })) || [],
        };
      });
      console.log(
        `✅ Data transformation completed (${Date.now() - transformStart}ms)`,
      );
    }

    // 6. If we have less than 20 personalized products, supplement with non-personalized
    if (personalizedProducts.length < limit) {
      const remaining = limit - personalizedProducts.length;
      console.log(
        `⚠️ Only found ${personalizedProducts.length} personalized products, adding ${remaining} non-personalized`,
      );

      // Get existing IDs to avoid duplicates
      const existingIds = new Set(personalizedProducts.map((p) => p.id));
      const combinedViewedIds = new Set([
        ...Array.from(existingIds),
        ...Array.from(viewedIds),
      ]);

      // Get user's sex filter for non-personalized products
      const sexFilter = await this.getSexFilterForUser(userId);

      // Normalize filterWhere to database format for non-personalized products
      const normalizedFilters = this.normalizeFiltersForDatabase(filterWhere);
      console.log(
        '🔄 Normalized filters for database:',
        JSON.stringify(normalizedFilters, null, 2),
      );

      // Use the existing helper method with database filters
      const nonPersonalizedProducts =
        await this.getNonPersonalizedFilteredProducts(
          normalizedFilters,
          sexFilter,
          combinedViewedIds,
          remaining,
        );

      personalizedProducts = [
        ...personalizedProducts,
        ...nonPersonalizedProducts,
      ];

      console.log(
        `✅ Added ${nonPersonalizedProducts.length} non-personalized products, total: ${personalizedProducts.length}`,
      );
    }

    // Log total time taken for performance monitoring
    console.log(`⏱️ Total personalization time: ${Date.now() - startTime}ms`);

    return personalizedProducts;
  }

  /**
   * Builds Qdrant filter from user preferences and frontend filters
   */
  private buildQdrantFilter(user: any, filterWhere: any): any {
    const mustConditions: any[] = [];

    // User gender preference
    const pref = user?.clothingPreferences?.toLowerCase() ?? '';
    if (pref === 'male') {
      mustConditions.push({ key: 'gender', match: { any: ['men', 'unisex'] } });
    } else if (pref === 'female') {
      mustConditions.push({
        key: 'gender',
        match: { any: ['women', 'unisex'] },
      });
    }

    // Retailer, brand, category
    const retailerCond = this.extractQdrantMatchCondition(
      'retailer',
      filterWhere.retailer,
    );
    if (retailerCond) mustConditions.push(retailerCond);

    const brandCond = this.extractQdrantMatchCondition(
      'brand',
      filterWhere.brand,
    );
    if (brandCond) mustConditions.push(brandCond);

    const categoryCond = this.extractQdrantMatchCondition(
      'category',
      filterWhere.category,
    );
    if (categoryCond) mustConditions.push(categoryCond);

    // --- Handle price filter from both flat and nested ---
    let minPrice = filterWhere.minPrice;
    let maxPrice = filterWhere.maxPrice;
    if (filterWhere.price) {
      if (typeof filterWhere.price.gte === 'number')
        minPrice = filterWhere.price.gte;
      if (typeof filterWhere.price.lte === 'number')
        maxPrice = filterWhere.price.lte;
    }
    const price = this.extractPriceRangeCondition(minPrice, maxPrice, 'qdrant');
    if (price) mustConditions.push(price);

    return mustConditions.length > 0 ? { must: mustConditions } : undefined;
  }

  private async postFilterByPrice(
    products: Array<{ id: number; payload: any }>,
    minPrice?: number,
    maxPrice?: number,
  ): Promise<Array<{ id: number; payload: any }>> {
    return products.filter((product) => {
      const price = product.payload?.price;
      if (typeof price !== 'number') return false;
      if (typeof minPrice === 'number' && price < minPrice) return false;
      if (typeof maxPrice === 'number' && price > maxPrice) return false;
      return true;
    });
  }

  // --- FILTER VALUE HELPERS ---
  private extractFilterValues(raw: any): string[] | undefined {
    if (!raw) return undefined;
    if (Array.isArray(raw))
      return raw.filter((v) => typeof v === 'string' && v.trim() !== '');
    if (typeof raw === 'string' && raw.trim() !== '') return [raw.trim()];
    if (raw.in && Array.isArray(raw.in))
      return raw.in.filter(
        (v: any) => typeof v === 'string' && v.trim() !== '',
      );
    return undefined;
  }

  private pushStringArrayCondition(
    target: any,
    key: string,
    values: string[] | undefined,
    mode: 'prisma' | 'qdrant',
  ) {
    if (!values || values.length === 0) return;
    if (mode === 'prisma') {
      target[key] = { in: values };
    } else if (mode === 'qdrant') {
      // Not used directly, but for completeness
      target[key] = { match: { any: values } };
    }
  }

  private extractQdrantMatchCondition(
    key: string,
    raw: any,
  ): { key: string; match: { any: string[] } } | null {
    const values = this.extractFilterValues(raw);
    if (values && values.length > 0) {
      return { key, match: { any: values } };
    }
    return null;
  }

  private extractPriceRangeCondition(
    minPrice: any,
    maxPrice: any,
    target: 'prisma' | 'qdrant',
  ) {
    if (typeof minPrice !== 'number' && typeof maxPrice !== 'number')
      return undefined;
    if (target === 'prisma') {
      const obj: any = {};
      if (typeof minPrice === 'number') obj.gte = minPrice;
      if (typeof maxPrice === 'number') obj.lte = maxPrice;
      return obj;
    } else {
      const range: any = {};
      if (typeof minPrice === 'number') range.gte = minPrice;
      if (typeof maxPrice === 'number') range.lte = maxPrice;
      return { key: 'price', range };
    }
  }

  // --- QDRANT BATCHING & DEDUPLICATION HELPERS ---
  private async searchQdrantInBatches(
    seedProductIds: number[],
    qdrantFilter: any,
    viewedIds: Set<number>,
    limit: number,
    maxSeeds: number,
    batchSize: number,
    startTime: number,
    maxTimeMs: number,
  ) {
    let allSimilarResults: Array<{ id: number; score: number; payload: any }> =
      [];
    for (
      let i = 0;
      i < Math.min(maxSeeds, seedProductIds.length);
      i += batchSize
    ) {
      if (Date.now() - startTime > maxTimeMs) {
        console.warn(
          `⚠️ Circuit breaker triggered at ${Date.now() - startTime}ms, stopping early`,
        );
        break;
      }
      const batch = seedProductIds.slice(i, i + batchSize);
      const batchPromises = batch.map(async (productId) => {
        return this.qdrantService.searchProductWithFilter({
          productId,
          filter: qdrantFilter,
          limit: Math.ceil((limit * 1.5) / maxSeeds),
          excludeIds: Array.from(viewedIds),
        });
      });
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach((similar) => {
        similar.forEach((result) => {
          if (!viewedIds.has(result.id)) {
            allSimilarResults.push({
              id: result.id,
              score: result.score,
              payload: result.payload,
            });
          }
        });
      });
    }
    return allSimilarResults;
  }

  private deduplicateQdrantResults(
    results: Array<{ id: number; score: number; payload: any }>,
    topK: number,
  ): [number[], Map<number, { score: number; payload: any }>] {
    const uniqueProducts = new Map<number, { score: number; payload: any }>();
    results.forEach((p) => {
      if (
        !uniqueProducts.has(p.id) ||
        p.score > uniqueProducts.get(p.id)!.score
      ) {
        uniqueProducts.set(p.id, { score: p.score, payload: p.payload });
      }
    });
    const topProductIds = Array.from(uniqueProducts.entries())
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, topK)
      .map(([id]) => id);
    return [topProductIds, uniqueProducts];
  }

  private async getSexFilterForUser(userId: number): Promise<any> {
    const u = await this.db.user.findUnique({ where: { id: userId } });
    const pref = u?.clothingPreferences?.toLowerCase() ?? '';
    if (pref === 'male') {
      return { sex: { in: ['men', 'unisex'] } };
    }
    if (pref === 'female') {
      return { sex: { in: ['women', 'unisex'] } };
    }
    return { sex: { in: ['men', 'women', 'unisex'] } };
  }

  // Helper: shuffle array
  private shuffle<T>(arr: T[]): T[] {
    return arr
      .map((a) => [Math.random(), a] as [number, T])
      .sort((a, b) => a[0] - b[0])
      .map((a) => a[1]);
  }
}
