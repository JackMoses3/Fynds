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
    const sexFilter = user ? getSexFilter(user.clothingPreferences) : {};

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
        include: { productImages: true },
      });

      return products.map((p) => ({
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
      include: { productImages: true },
    });

    // Map to DTO
    return products.map((p) => ({
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

// Helper: get sex filter for clothingPreferences
function getSexFilter(pref: string) {
  const p = pref?.toLowerCase?.() ?? '';
  if (p === 'male') return { sex: { in: ['men', 'unisex'] } };
  if (p === 'female') return { sex: { in: ['women', 'unisex'] } };
  return { sex: { in: ['men', 'women', 'unisex'] } };
}

// Helper: shuffle array
function shuffle<T>(arr: T[]): T[] {
  return arr
    .map((a) => [Math.random(), a] as [number, T])
    .sort((a, b) => a[0] - b[0])
    .map((a) => a[1]);
}
