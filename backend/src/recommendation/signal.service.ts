import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { 
  UserSignal, 
  SignalType, 
  SignalConfig,
  ColdStartInfo 
} from './dto/recommendation.dto';

/**
 * Service responsible for collecting and scoring user interaction signals
 * for personalized recommendations
 */
@Injectable()
export class SignalService {
  private readonly logger = new Logger(SignalService.name);

  // Signal configuration based on requirements
  private readonly signalConfigs: Record<SignalType, SignalConfig> = {
    [SignalType.ONBOARDING]: {
      baseWeight: 2.0,
      recencyDecayHours: 720, // 30 days
    },
    [SignalType.LIKE]: {
      baseWeight: 3.0,
      recencyDecayHours: 168, // 7 days
      additionalBoost: 0.5, // Applied if scrollDepth >= 3
    },
    [SignalType.COLLECTION]: {
      baseWeight: 3.0,
      recencyDecayHours: 168, // 7 days
    },
    [SignalType.TROLLEY]: {
      baseWeight: 4.0,
      recencyDecayHours: 168, // 7 days
    },
    [SignalType.VIEWING]: {
      baseWeight: 1.0,
      recencyDecayHours: 72, // 3 days
      additionalBoost: 0.2, // Applied if scrollLength >= 3000ms
    },
  };

  constructor(private readonly db: DatabaseService) {}

  /**
   * Collect all user interaction signals from various tables
   * Fetches last 100 rows from each signal table and all onboarding products
   */
  async collectSignals(userId: number): Promise<UserSignal[]> {
    const startTime = Date.now();
    this.logger.debug(`Collecting signals for user ${userId}`);

    const [
      onboardingSignals,
      likeSignals,
      collectionSignals,
      trolleySignals,
      viewingSignals,
    ] = await Promise.all([
      this.collectOnboardingSignals(userId),
      this.collectLikeSignals(userId),
      this.collectCollectionSignals(userId),
      this.collectTrolleySignals(userId),
      this.collectViewingSignals(userId),
    ]);

    const allSignals = [
      ...onboardingSignals,
      ...likeSignals,
      ...collectionSignals,
      ...trolleySignals,
      ...viewingSignals,
    ];

    const collectionTime = Date.now() - startTime;
    this.logger.debug(
      `Collected ${allSignals.length} signals in ${collectionTime}ms`,
    );

    return allSignals;
  }

  /**
   * Score all collected signals using exponential decay formula
   * Final weight = baseWeight * e^(-ageHours/τ) + boost
   */
  async scoreSignals(signals: UserSignal[]): Promise<UserSignal[]> {
    const now = new Date();
    const scoredSignals = signals.map((signal) => {
      const ageHours = (now.getTime() - signal.createdAt.getTime()) / (1000 * 60 * 60);
      const config = this.signalConfigs[signal.source];
      
      // Calculate base weight with exponential decay
      let weight = config.baseWeight * Math.exp(-ageHours / config.recencyDecayHours);
      
      // Apply additional boost if conditions are met
      if (config.additionalBoost) {
        if (signal.source === SignalType.LIKE && signal.scrollDepth && signal.scrollDepth >= 3) {
          weight += config.additionalBoost;
        } else if (signal.source === SignalType.VIEWING && signal.scrollLength && signal.scrollLength >= 3000) {
          weight += config.additionalBoost;
        }
      }

      // Apply weight clamping for high-engagement signals
      if (signal.scrollDepth && signal.scrollDepth >= 5 || 
          signal.scrollLength && signal.scrollLength >= 6000) {
        weight = Math.min(weight, 5.0);
      }

      return {
        ...signal,
        weight,
      };
    });

    // Sort by weight descending
    return scoredSignals.sort((a, b) => b.weight - a.weight);
  }

  /**
   * Detect if user is in cold start phase
   * Cold start: user < 7 days old AND < 30 interaction rows
   */
  async detectColdStart(userId: number): Promise<ColdStartInfo> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const userAgeDays = (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    
    // Count total interactions
    const [likeCount, collectionCount, trolleyCount, viewingCount, onboardingCount] = await Promise.all([
      this.db.like.count({ where: { userId } }),
      this.db.collectionItem.count({ where: { collection: { userId } } }),
      this.db.trolleyItem.count({ where: { shoppingTrolley: { userId } } }),
      this.db.viewingHistory.count({ where: { userId } }),
      this.db.onboardingProduct.count({ where: { userId } }),
    ]);

    const totalInteractions = likeCount + collectionCount + trolleyCount + viewingCount + onboardingCount;
    const isColdStart = userAgeDays < 7 && totalInteractions < 30;

    return {
      isColdStart,
      userAgeDays,
      totalInteractions,
      onboardingWeightMultiplier: isColdStart ? 2.0 : 1.0,
      randomQuota: isColdStart ? 6 : 3,
    };
  }

  /**
   * Get user's recent viewing history for exclusion
   */
  async getRecentViewingHistory(userId: number, limit: number = 160): Promise<number[]> {
    const recentViews = await this.db.viewingHistory.findMany({
      where: { userId },
      select: { productItemId: true },
      orderBy: { viewedAt: 'desc' },
      take: limit,
    });

    return recentViews.map(v => v.productItemId);
  }

  /**
   * Get user's liked/saved/trolley products for exclusion
   */
  async getExcludedProducts(userId: number): Promise<number[]> {
    const [likedProducts, savedProducts, trolleyProducts] = await Promise.all([
      this.db.like.findMany({
        where: { userId },
        select: { productItemId: true },
      }),
      this.db.collectionItem.findMany({
        where: { collection: { userId } },
        select: { productItemId: true },
      }),
      this.db.trolleyItem.findMany({
        where: { shoppingTrolley: { userId } },
        select: { productItemId: true },
      }),
    ]);

    const excludedIds = new Set([
      ...likedProducts.map(p => p.productItemId),
      ...savedProducts.map(p => p.productItemId),
      ...trolleyProducts.map(p => p.productItemId),
    ]);

    return Array.from(excludedIds);
  }

  /**
   * Collect onboarding product signals
   */
  private async collectOnboardingSignals(userId: number): Promise<UserSignal[]> {
    const onboardingProducts = await this.db.onboardingProduct.findMany({
      where: { userId },
      select: { productItemId: true, createdAt: true },
    });

    return onboardingProducts.map((op) => ({
      productId: op.productItemId,
      weight: 0, // Will be calculated in scoreSignals
      createdAt: op.createdAt,
      source: SignalType.ONBOARDING,
    }));
  }

  /**
   * Collect like signals (last 100)
   */
  private async collectLikeSignals(userId: number): Promise<UserSignal[]> {
    const likes = await this.db.like.findMany({
      where: { userId },
      select: { productItemId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return likes.map((like) => ({
      productId: like.productItemId,
      weight: 0,
      createdAt: like.createdAt,
      source: SignalType.LIKE,
    }));
  }

  /**
   * Collect collection item signals (last 100)
   */
  private async collectCollectionSignals(userId: number): Promise<UserSignal[]> {
    const collectionItems = await this.db.collectionItem.findMany({
      where: { collection: { userId } },
      select: { 
        productItemId: true,
        collection: {
          select: { createdAt: true }
        }
      },
      orderBy: { collection: { createdAt: 'desc' } },
      take: 100,
    });

    return collectionItems.map((item) => ({
      productId: item.productItemId,
      weight: 0,
      createdAt: item.collection.createdAt,
      source: SignalType.COLLECTION,
    }));
  }

  /**
   * Collect trolley item signals (last 100)
   */
  private async collectTrolleySignals(userId: number): Promise<UserSignal[]> {
    const trolleyItems = await this.db.trolleyItem.findMany({
      where: { shoppingTrolley: { userId } },
      select: { 
        productItemId: true,
        shoppingTrolley: {
          select: { createdAt: true }
        }
      },
      orderBy: { shoppingTrolley: { createdAt: 'desc' } },
      take: 100,
    });

    return trolleyItems.map((item) => ({
      productId: item.productItemId,
      weight: 0,
      createdAt: item.shoppingTrolley.createdAt,
      source: SignalType.TROLLEY,
    }));
  }

  /**
   * Collect viewing history signals (last 100)
   */
  private async collectViewingSignals(userId: number): Promise<UserSignal[]> {
    const viewingHistory = await this.db.viewingHistory.findMany({
      where: { userId },
      select: { 
        productItemId: true, 
        viewedAt: true,
        scrollLength: true,
        scrollDepth: true,
      },
      orderBy: { viewedAt: 'desc' },
      take: 100,
    });

    return viewingHistory.map((view) => ({
      productId: view.productItemId,
      weight: 0,
      createdAt: view.viewedAt,
      source: SignalType.VIEWING,
      scrollLength: view.scrollLength || undefined,
      scrollDepth: view.scrollDepth || undefined,
    }));
  }
} 