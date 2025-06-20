import { Injectable, Logger } from '@nestjs/common';
import { QdrantService } from '../qdrant/qdrant.service';
import { DatabaseService } from '../database/database.service';
import { QdrantSearchResult } from './dto/recommendation.dto';
import { CollectionType } from '../qdrant/dto/qdrant.dto';

/**
 * Service responsible for Qdrant vector similarity searches
 * for personalized product recommendations
 */
@Injectable()
export class QdrantRecommendationService {
  private readonly logger = new Logger(QdrantRecommendationService.name);

  constructor(
    private readonly qdrantService: QdrantService,
    private readonly db: DatabaseService,
  ) {}

  /**
   * Retrieve candidate products from Qdrant for a given signal product
   * Searches for k=30 nearest neighbors and filters out excluded products
   */
  async retrieveCandidatesFromQdrant(
    signalProductId: number,
    excludedProductIds: number[],
    k: number = 30,
  ): Promise<QdrantSearchResult[]> {
    const startTime = Date.now();
    this.logger.debug(
      `Retrieving candidates for signal product ${signalProductId}`,
    );

    // Get the signal product's embeddings from database
    const signalProduct = await this.db.productItem.findUnique({
      where: { id: signalProductId },
      select: {
        id: true,
        embedding: true,
        sex: true,
        category: true,
      },
    });

    if (
      !signalProduct ||
      !signalProduct.embedding ||
      signalProduct.embedding === 'skip'
    ) {
      this.logger.debug(
        `Signal product ${signalProductId} has no valid embedding`,
      );
      return [];
    }

    // Use the searchProduct method which handles all collections automatically
    try {
      const results = await this.qdrantService.searchProduct({
        productId: signalProductId,
        searchDto: {
          top_k: k,
          qdrantFilter: {
            gender: [signalProduct.sex as any, 'unisex'],
            style: signalProduct.category
              ? [signalProduct.category]
              : undefined,
          },
        },
      });

      // Filter out excluded products and the signal product itself
      const filteredResults = results
        .filter(
          (result) =>
            result.id !== signalProductId &&
            !excludedProductIds.includes(result.id),
        )
        .map((result) => ({
          id: result.id,
          score: result.distance, // Qdrant returns distance, convert to score
          payload: undefined, // Not available in current response
        }));

      const searchTime = Date.now() - startTime;
      this.logger.debug(
        `Retrieved ${filteredResults.length} candidates in ${searchTime}ms for product ${signalProductId}`,
      );

      return filteredResults;
    } catch (error) {
      this.logger.error(
        `Error searching for product ${signalProductId}: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Get random eligible products for diversity
   * Filters by sex preference and excludes products without embeddings
   */
  async getRandomEligibleProducts(
    userId: number,
    limit: number,
    excludedProductIds: number[],
  ): Promise<number[]> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { clothingPreferences: true },
    });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Build sex filter based on user preferences
    let sexFilter: string[] = [];
    switch (user.clothingPreferences) {
      case 'male':
        sexFilter = ['men', 'unisex'];
        break;
      case 'female':
        sexFilter = ['women', 'unisex'];
        break;
      case 'both':
        sexFilter = ['men', 'women', 'unisex'];
        break;
      default:
        sexFilter = ['men', 'women', 'unisex'];
    }

    // Get random products that meet criteria
    const eligibleProducts = await this.db.productItem.findMany({
      where: {
        sex: { in: sexFilter },
        AND: [
          { embedding: { not: 'skip' } },
          { embedding: { not: null } },
          { category: { not: 'Uncategorized' } },
          { category: { not: null } },
        ],
        id: { notIn: excludedProductIds },
      },
      select: { id: true },
      take: limit * 3, // Get more to account for potential exclusions
    });

    // Shuffle and return requested number
    const shuffled = this.shuffleArray(eligibleProducts.map((p) => p.id));
    return shuffled.slice(0, limit);
  }

  /**
   * Ensure retailer diversity in the final batch
   * Maintains at least 3 distinct retailers across the batch
   */
  async ensureRetailerDiversity(
    candidateProductIds: number[],
    targetRetailerCount: number = 3,
  ): Promise<number[]> {
    if (candidateProductIds.length === 0) {
      return [];
    }

    // Get retailer information for candidates
    const products = await this.db.productItem.findMany({
      where: { id: { in: candidateProductIds } },
      select: { id: true, retailer: true },
    });

    const productRetailerMap = new Map(products.map((p) => [p.id, p.retailer]));
    const selectedIds: number[] = [];
    const selectedRetailers = new Set<string>();

    // First pass: select products to ensure retailer diversity
    for (const productId of candidateProductIds) {
      const retailer = productRetailerMap.get(productId);
      if (!retailer) continue;

      if (
        selectedRetailers.size < targetRetailerCount ||
        selectedRetailers.has(retailer)
      ) {
        selectedIds.push(productId);
        selectedRetailers.add(retailer);
      }

      if (selectedIds.length >= 20) break; // Limit batch size
    }

    return selectedIds;
  }

  /**
   * Remove duplicate results from multiple collection searches
   */
  private deduplicateResults(
    results: QdrantSearchResult[],
  ): QdrantSearchResult[] {
    const seen = new Set<number>();
    const unique: QdrantSearchResult[] = [];

    for (const result of results) {
      if (!seen.has(result.id)) {
        seen.add(result.id);
        unique.push(result);
      }
    }

    return unique;
  }

  /**
   * Fisher-Yates shuffle algorithm for random product selection
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
