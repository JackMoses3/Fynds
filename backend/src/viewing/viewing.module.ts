import { Module } from '@nestjs/common';
import { ViewingService } from './viewing.service';
import { ViewingController } from './viewing.controller';
import { DatabaseModule } from '../database/database.module';
import { ProductScoreService } from '../recommendation/service/product-score.service';

@Module({
  imports: [DatabaseModule],
  providers: [ViewingService, ProductScoreService],
  controllers: [ViewingController],
  exports: [ViewingService],
})
export class ViewingModule {}
