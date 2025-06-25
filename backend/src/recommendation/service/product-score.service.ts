import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class ProductScoreService {
  private readonly logger = new Logger(ProductScoreService.name);

  constructor(private readonly db: DatabaseService) {}

  private static readonly WEIGHTS = {
    trolleyItem: 10,
    collectionItem: 8,
    like: 5,
    onboarding: 2,
  };

  async addScore(params: {
    userId: number;
    productItemId: number;
    signals: {
      onboarding?: boolean;
      scrollLength?: number;
      scrollDepth?: number;
      scrollTime?: number;
      collectionItem?: boolean;
      like?: boolean;
      trolleyItem?: boolean;
    };
  }) {
    const {
      onboarding = false,
      scrollLength = 0,
      scrollDepth = 0,
      scrollTime = 0,
      collectionItem = false,
      like = false,
      trolleyItem = false,
    } = params.signals;

    let score = 0;
    const debug: Record<string, any> = {};

    // Trolley, collection, like, onboarding (unchanged)
    if (trolleyItem) {
      score += ProductScoreService.WEIGHTS.trolleyItem;
      debug.trolleyItem = ProductScoreService.WEIGHTS.trolleyItem;
    }
    if (collectionItem) {
      score += ProductScoreService.WEIGHTS.collectionItem;
      debug.collectionItem = ProductScoreService.WEIGHTS.collectionItem;
    }
    if (like) {
      score += ProductScoreService.WEIGHTS.like;
      debug.like = ProductScoreService.WEIGHTS.like;
    }
    if (onboarding) {
      score += ProductScoreService.WEIGHTS.onboarding;
      debug.onboarding = ProductScoreService.WEIGHTS.onboarding;
    }

    // --- Updated viewing scoring logic ---
    // 1. Each second viewing (up to 10s): +0.2 per second
    const scrollTimeScore = Number((Math.min(scrollTime, 10) * 0.2).toFixed(2));
    score += scrollTimeScore;
    debug.scrollTime = scrollTime;
    debug.scrollTimeScore = scrollTimeScore;

    // 2. Scroll depth as decimal (e.g., 0.5 for 50%) * 3
    let normalizedScrollDepth = scrollDepth ?? 0;
    if (normalizedScrollDepth > 1) {
      normalizedScrollDepth = normalizedScrollDepth / 100;
    }
    normalizedScrollDepth = Number(normalizedScrollDepth.toFixed(2));
    const scrollDepthScore = Number((normalizedScrollDepth * 3).toFixed(2));
    score += scrollDepthScore;
    debug.scrollDepth = scrollDepth;
    debug.normalizedScrollDepth = normalizedScrollDepth;
    debug.scrollDepthScore = scrollDepthScore;

    // 3. Scroll length: +1 per horizontal scroll, max 5
    const scrollLengthScore = Math.min(scrollLength ?? 0, 5) * 1;
    score += scrollLengthScore;
    debug.scrollLength = scrollLength;
    debug.scrollLengthScore = scrollLengthScore;

    score = Number(score.toFixed(2));
    debug.totalScore = score;

    this.logger.log(
      `[ProductScore] userId=${params.userId}, productItemId=${params.productItemId}, signals=${JSON.stringify(
        params.signals,
      )}, breakdown=${JSON.stringify(debug)}`,
    );

    await this.db.productScore.create({
      data: {
        userId: params.userId,
        productItemId: params.productItemId,
        score,
      },
    });

    return score;
  }
}
