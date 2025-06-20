import { Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { DatabaseService } from '../database/database.service';
import { SignalService } from './signal.service';
import { QdrantRecommendationService } from './qdrant-recommendation.service';
import {
  UserSignal,
  FeedBatchDto,
  FeedBatchMeta,
  ProductItemDto,
  SegmentType,
  FeedSegment,
  PersonalizedFeedQueryDto,
  ColdStartInfo,
} from './dto/recommendation.dto';

/**
 * Main recommendation service that orchestrates personalized feed generation
 * Implements the complete algorithm from requirements
 */
@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly signalService: SignalService,
    private readonly qdrantService: QdrantRecommendationService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Generate personalized feed batch for a user
   * Main entry point for the recommendation system
   */
  async generatePersonalizedFeed(
    userId: number,
    query: PersonalizedFeedQueryDto,
  ): Promise<FeedBatchDto> {
    const startTime = Date.now();
    this.logger.log(
      `Generating personalized feed for user ${userId}, stage ${query.stage}`,
    );

    // Check cache first
    const cacheKey = `feed:${userId}:${query.stage}`;
    const cached = await this.cacheManager.get<FeedBatchDto>(cacheKey);
    if (cached) {
      this.logger.debug(
        `Returning cached feed for user ${userId}, stage ${query.stage}`,
      );
      return cached;
    }

    try {
      // Step 1: Collect and score user signals
      const signals = await this.signalService.collectSignals(userId);
      const scoredSignals = await this.signalService.scoreSignals(signals);

      // Step 2: Detect cold start
      const coldStartInfo = await this.signalService.detectColdStart(userId);
      if (coldStartInfo.isColdStart) {
        this.logger.debug(`User ${userId} is in cold start mode`);
        // Apply cold start adjustments
        scoredSignals.forEach((signal) => {
          if (signal.source === 'onboarding') {
            signal.weight *= coldStartInfo.onboardingWeightMultiplier;
          }
        });
      }

      // Step 3: Select feed segments
      const segments = this.selectSegments(
        scoredSignals,
        coldStartInfo,
        query.limit || 20,
      );

      // Step 4: Get excluded products
      const [recentViews, excludedProducts] = await Promise.all([
        this.signalService.getRecentViewingHistory(userId),
        this.signalService.getExcludedProducts(userId),
      ]);
      const allExcluded = [...recentViews, ...excludedProducts];

      // Step 5: Retrieve candidates from Qdrant
      const candidateProductIds = await this.retrieveCandidatesFromQdrant(
        segments,
        allExcluded,
        userId,
      );

      // Step 6: Filter and diversify
      const filteredProducts = await this.filterAndDiversify(
        candidateProductIds,
        userId,
        query.limit || 20,
      );

      // Step 7: Shuffle and format response
      const shuffledProducts = this.shuffleFeed(filteredProducts, segments);
      const products = await this.formatProducts(shuffledProducts);

      const totalTime = Date.now() - startTime;
      const batchMeta: FeedBatchMeta = {
        userId,
        generatedAt: new Date().toISOString(),
        stage: query.stage,
        totalProcessed: scoredSignals.length,
        totalSuccessful: products.length,
        totalFailed: 0,
      };

      const result: FeedBatchDto = {
        batchMeta,
        products,
      };

      // Cache the result
      await this.cacheManager.set(cacheKey, result, 600); // 10 minutes TTL

      this.logger.log(
        `Generated feed for user ${userId}: ${products.length} products in ${totalTime}ms`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Error generating feed for user ${userId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Select feed segments based on scored signals
   */
  private selectSegments(
    scoredSignals: UserSignal[],
    coldStartInfo: ColdStartInfo,
    limit: number,
  ): FeedSegment[] {
    const segments: FeedSegment[] = [];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Recent signals (top 14)
    const recentSignals = scoredSignals
      .filter((signal) => signal.createdAt > sevenDaysAgo)
      .slice(0, 14);

    if (recentSignals.length > 0) {
      segments.push({
        type: SegmentType.RECENT,
        productIds: recentSignals.map((s) => s.productId),
        sourceSignals: recentSignals,
      });
    }

    // Historical signals (top 3 from >= 7 days old)
    const historicalSignals = scoredSignals
      .filter((signal) => signal.createdAt <= sevenDaysAgo)
      .slice(0, 3);

    if (historicalSignals.length > 0) {
      segments.push({
        type: SegmentType.HISTORICAL,
        productIds: historicalSignals.map((s) => s.productId),
        sourceSignals: historicalSignals,
      });
    }

    // Calculate how many random products we need
    const totalSignalProducts = recentSignals.length + historicalSignals.length;
    let randomQuota = Math.ceil(limit * 0.2); // Default 20% random

    // If we have very few signals, increase random quota
    if (totalSignalProducts < 5) {
      randomQuota = Math.ceil(limit * 0.6); // 60% random for cold start
    } else if (totalSignalProducts < 10) {
      randomQuota = Math.ceil(limit * 0.4); // 40% random for warm start
    }

    // Add random segment
    segments.push({
      type: SegmentType.RANDOM,
      productIds: [], // Will be filled in filterAndDiversify
      sourceSignals: [],
    });

    this.logger.debug(
      `Selected ${segments.length} segments: ${recentSignals.length} recent, ${historicalSignals.length} historical, ${randomQuota} random`,
    );

    return segments;
  }

  /**
   * Retrieve candidate products from Qdrant for each segment
   */
  private async retrieveCandidatesFromQdrant(
    segments: FeedSegment[],
    excludedProductIds: number[],
    userId: number,
  ): Promise<number[]> {
    const allCandidates: number[] = [];

    for (const segment of segments) {
      if (segment.type === SegmentType.RANDOM) {
        // Random segment will be handled in filterAndDiversify
        continue;
      }

      // Get candidates for each signal product in the segment
      for (const productId of segment.productIds) {
        const candidates =
          await this.qdrantService.retrieveCandidatesFromQdrant(
            productId,
            excludedProductIds,
            100, // Increased to top 100 candidates per signal
          );

        // Add top candidates to results (take top 5 from each signal)
        const topCandidates = candidates.slice(0, 5);
        allCandidates.push(...topCandidates.map(c => c.id));
      }
    }

    return allCandidates;
  }

  /**
   * Filter and diversify the candidate products
   */
  private async filterAndDiversify(
    candidateProductIds: number[],
    userId: number,
    limit: number,
  ): Promise<number[]> {
    // Get user preferences for filtering
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { clothingPreferences: true },
    });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Apply sex filter
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

    // Filter products by sex and other criteria
    const filteredProducts = await this.db.productItem.findMany({
      where: {
        id: { in: candidateProductIds },
        sex: { in: sexFilter },
        AND: [
          { embedding: { not: 'skip' } },
          { embedding: { not: null } },
          { category: { not: 'Uncategorized' } },
          { category: { not: null } },
        ],
      },
      select: { id: true, retailer: true },
    });

    // Ensure retailer diversity (at least 3 distinct retailers)
    const diverseProducts = await this.qdrantService.ensureRetailerDiversity(
      filteredProducts.map((p) => p.id),
      3,
    );

    // Calculate random quota based on how many signal-based products we have
    let randomQuota = Math.ceil(limit * 0.2); // Default 20% random
    if (diverseProducts.length < 5) {
      randomQuota = Math.ceil(limit * 0.6); // 60% random for cold start
    } else if (diverseProducts.length < 10) {
      randomQuota = Math.ceil(limit * 0.4); // 40% random for warm start
    }

    // If we don't have enough diverse products, add more random products
    let finalProducts = [...diverseProducts];
    if (finalProducts.length < limit) {
      const remainingNeeded = limit - finalProducts.length;
      const randomProducts = await this.qdrantService.getRandomEligibleProducts(
        userId,
        remainingNeeded,
        finalProducts,
      );
      finalProducts.push(...randomProducts);
    } else {
      // Add random products for diversity
      const randomProducts = await this.qdrantService.getRandomEligibleProducts(
        userId,
        randomQuota,
        finalProducts,
      );
      finalProducts.push(...randomProducts);
    }

    // Limit to requested size
    return finalProducts.slice(0, limit);
  }

  /**
   * Shuffle feed items to avoid obvious patterns
   */
  private shuffleFeed(productIds: number[], segments: FeedSegment[]): number[] {
    // Simple interleaving: [recent, recent, historical, recent, random, random, historical, ...]
    const shuffled: number[] = [];
    const segmentProductIds = segments
      .filter((s) => s.type !== SegmentType.RANDOM)
      .flatMap((s) => s.productIds);

    let recentIndex = 0;
    let historicalIndex = 0;
    let randomIndex = 0;

    for (let i = 0; i < productIds.length; i++) {
      if (i % 3 === 0 && recentIndex < segmentProductIds.length) {
        shuffled.push(segmentProductIds[recentIndex++]);
      } else if (i % 3 === 1 && historicalIndex < segmentProductIds.length) {
        shuffled.push(segmentProductIds[historicalIndex++]);
      } else {
        shuffled.push(productIds[randomIndex++]);
      }
    }

    return shuffled;
  }

  /**
   * Format product IDs into full product DTOs
   */
  private async formatProducts(
    productIds: number[],
  ): Promise<ProductItemDto[]> {
    if (productIds.length === 0) {
      return [];
    }

    const products = await this.db.productItem.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        brand: true,
        category: true,
        price: true,
        retailer: true,
        url: true,
        sex: true,
        productImages: {
          select: { id: true, imageUrl: true, frontFacing: true },
          orderBy: { id: 'asc' },
        },
        productStyles: {
          select: { style: { select: { name: true } } },
        },
      },
    });

    // Maintain order from input
    const productMap = new Map(products.map((p) => [p.id, p]));
    return productIds
      .map((id) => productMap.get(id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined)
      .map((product) => ({
        id: product.id,
        name: product.name,
        brand: product.brand,
        category: product.category,
        price: product.price,
        retailer: product.retailer,
        url: product.url,
        sex: product.sex,
        images: product.productImages.map((img) => ({
          id: img.id,
          imageUrl: img.imageUrl,
          frontFacing: img.frontFacing,
        })),
        styles: product.productStyles.map((ps) => ps.style.name),
      }));
  }
}
