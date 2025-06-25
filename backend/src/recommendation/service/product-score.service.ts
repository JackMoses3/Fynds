import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class ProductScoreService {
  private readonly logger = new Logger(ProductScoreService.name);

  private static readonly WEIGHTS = {
    trolleyItem: 10,
    collectionItem: 8,
    like: 5,
    onboarding: 2,
  };

  constructor(private readonly db: DatabaseService) {}

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

    // 1) Calculate the incremental score
    let delta = 0;
    const debug: Record<string, any> = {};

    if (trolleyItem) {
      delta += ProductScoreService.WEIGHTS.trolleyItem;
      debug.trolleyItem = ProductScoreService.WEIGHTS.trolleyItem;
    }
    if (collectionItem) {
      delta += ProductScoreService.WEIGHTS.collectionItem;
      debug.collectionItem = ProductScoreService.WEIGHTS.collectionItem;
    }
    if (like) {
      delta += ProductScoreService.WEIGHTS.like;
      debug.like = ProductScoreService.WEIGHTS.like;
    }
    if (onboarding) {
      delta += ProductScoreService.WEIGHTS.onboarding;
      debug.onboarding = ProductScoreService.WEIGHTS.onboarding;
    }

    const scrollTimeScore = Number((Math.min(scrollTime, 10) * 0.2).toFixed(2));
    delta += scrollTimeScore;
    debug.scrollTime = scrollTime;
    debug.scrollTimeScore = scrollTimeScore;

    let nsd = scrollDepth;
    if (nsd > 1) nsd = nsd / 100;
    nsd = Number(nsd.toFixed(2));
    const scrollDepthScore = Number((nsd * 3).toFixed(2));
    delta += scrollDepthScore;
    debug.scrollDepth = scrollDepth;
    debug.normalizedScrollDepth = nsd;
    debug.scrollDepthScore = scrollDepthScore;

    const scrollLengthScore = Math.min(scrollLength, 5);
    delta += scrollLengthScore;
    debug.scrollLength = scrollLength;
    debug.scrollLengthScore = scrollLengthScore;

    const inc = Number(delta.toFixed(2));
    debug.totalScore = inc;

    this.logger.log(
      `[ProductScore] userId=${params.userId}, productItemId=${params.productItemId}, signals=${JSON.stringify(
        params.signals,
      )}, breakdown=${JSON.stringify(debug)}`,
    );

    // 2) Manual upsert: find existing row for (userId, productItemId)
    const existing = await this.db.productScore.findFirst({
      where: {
        userId: params.userId,
        productItemId: params.productItemId,
      },
      orderBy: { created: 'desc' }, // just in case multiple; pick latest
    });

    if (existing) {
      // update the existing total
      return this.db.productScore.update({
        where: { id: existing.id },
        data: { score: (existing.score ?? 0) + inc },
      });
    } else {
      // no row yet → create a fresh one
      return this.db.productScore.create({
        data: {
          userId: params.userId,
          productItemId: params.productItemId,
          score: inc,
        },
      });
    }
  }
}
