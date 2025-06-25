import { Module } from '@nestjs/common';
import { CollectionService } from './collection.service';
import { CollectionController } from './collection.controller';
import { DatabaseModule } from '../database/database.module';
import { ProductScoreService } from '../recommendation/service/product-score.service';

@Module({
  controllers: [CollectionController],
  providers: [CollectionService, ProductScoreService],
  imports: [DatabaseModule],
})
export class CollectionModule {}
