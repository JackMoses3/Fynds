import { Module } from '@nestjs/common';
import { ProductItemService } from './product-item.service';
import { ProductItemController } from './product-item.controller';
import { DatabaseModule } from '../database/database.module';
import { RecommendationService } from '../recommendation/recommendation.service';
import { QdrantService } from '../qdrant/qdrant.service';
import { ProductScoreService } from '../recommendation/service/product-score.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ProductItemController],
  providers: [
    ProductItemService,
    RecommendationService,
    QdrantService,
    ProductScoreService,
  ],
  exports: [ProductItemService],
})
export class ProductItemModule {}
