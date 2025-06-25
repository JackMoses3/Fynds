import { Module } from '@nestjs/common';
import { LikeController } from './like.controller';
import { LikeService } from './like.service';
import { DatabaseModule } from '../database/database.module';
import { ProductScoreService } from '../recommendation/service/product-score.service';

@Module({
  imports: [DatabaseModule],
  controllers: [LikeController],
  providers: [LikeService, ProductScoreService],
  exports: [LikeService],
})
export class LikeModule {}
