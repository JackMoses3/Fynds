import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { RecommendationService } from './recommendation.service';
import { RecommendationController } from './recommendation.controller';
import { SignalService } from './signal.service';
import { QdrantRecommendationService } from './qdrant-recommendation.service';
import { DatabaseService } from '../database/database.service';
import { QdrantService } from '../qdrant/qdrant.service';

@Module({
  imports: [
    CacheModule.register({
      ttl: 600, // 10 minutes
      max: 1000, // Maximum number of items in cache
    }),
  ],
  controllers: [RecommendationController],
  providers: [
    RecommendationService,
    SignalService,
    QdrantRecommendationService,
    DatabaseService,
    QdrantService,
  ],
  exports: [RecommendationService],
})
export class RecommendationModule {} 