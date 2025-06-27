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
    const sexFilter = user ? this.getSexFilterForUser(userId) : {};

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
        randomIds = shuffle(randomProducts.map((p) => p.id)).filter(
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
    let randomIds = shuffle(randomProducts.map((p) => p.id));

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
    const start = Date.now();
    const maxMs = 9500;

    // 1) top-10 scores
    const rawScores = await this.db.productScore.findMany({
      where: { userId },
      orderBy: { score: 'desc' },
      take: 10,
      select: { productItemId: true, score: true },
    });
    if (rawScores.length === 0) {
      const sexFilter = await this.getSexFilterForUser(userId);
      const viewedIds = await this.getRecentlyViewedProductIds(userId);
      return this.getNonPersonalizedFilteredProducts(
        filterWhere,
        sexFilter,
        viewedIds,
        limit,
      );
    }

    // 2) fetch embeddings
    const seedIds = rawScores.map((s) => s.productItemId);
    const seedRows = await this.db.productItem.findMany({
      where: { id: { in: seedIds } },
      select: { id: true, embedding: true },
    });

    // drop any null/empty embeddings
    const validSeeds = seedRows.filter(
      (r): r is { id: number; embedding: string | null } =>
        Array.isArray(r.embedding) && r.embedding.length > 0,
    );
    if (validSeeds.length === 0) {
      const sexFilter = await this.getSexFilterForUser(userId);
      const viewedIds = await this.getRecentlyViewedProductIds(userId);
      return this.getNonPersonalizedFilteredProducts(
        filterWhere,
        sexFilter,
        viewedIds,
        limit,
      );
    }

    // 3) build weighted centroid
    const dim = validSeeds[0].embedding ? validSeeds[0].embedding.length : 0;
    const centroid = new Array<number>(dim).fill(0);
    validSeeds.forEach((row) => {
      const w = rawScores.find((s) => s.productItemId === row.id)!.score ?? 0;
      JSON.parse(row.embedding ?? '[]').forEach((v: number, i: number) => {
        centroid[i] += v * w;
      });
    });
    for (let i = 0; i < dim; i++) {
      centroid[i] /= validSeeds.length;
    }

    // 4) single Qdrant call
    const qRes = await this.qdrantService.searchByVector({
      vector: centroid,
      searchDto: { top_k: limit * 5 },
    });

    if (!Array.isArray(qRes)) {
      throw new Error(
        'Unexpected response from QdrantService: Expected an array',
      );
    }

    // 5) time-box end-to-end
    if (Date.now() - start > maxMs) {
      const ids = qRes.map((r) => r.id).slice(0, limit);
      const items = await this.db.productItem.findMany({
        where: { id: { in: ids } },
        include: { productImages: { orderBy: { id: 'asc' } } },
      });
      return this.mapProductsToDto(items);
    }

    // 6) final DB lookup & map
    const finalIds = qRes.map((r) => r.id).slice(0, limit);
    const finalProducts = await this.db.productItem.findMany({
      where: { id: { in: finalIds } },
      include: { productImages: { orderBy: { id: 'asc' } } },
    });

    console.log(`⏱️ personalization total: ${Date.now() - start}ms`);
    return this.mapProductsToDto(finalProducts);
  }

  // Make sure these helpers exist in the same class:

  private async getSexFilterForUser(userId: number): Promise<any> {
    const u = await this.db.user.findUnique({ where: { id: userId } });
    const pref = u?.clothingPreferences?.toLowerCase() ?? '';
    if (pref === 'male') return { sex: { in: ['men', 'unisex'] } };
    if (pref === 'female') return { sex: { in: ['women', 'unisex'] } };
    return { sex: { in: ['men', 'women', 'unisex'] } };
  }
}

// Helper: shuffle array
function shuffle<T>(arr: T[]): T[] {
  return arr
    .map((a) => [Math.random(), a] as [number, T])
    .sort((a, b) => a[0] - b[0])
    .map((a) => a[1]);
}
