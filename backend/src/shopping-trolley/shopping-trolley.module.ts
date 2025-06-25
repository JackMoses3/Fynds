import { Module } from '@nestjs/common';
import { ShoppingTrolleyService } from './shopping-trolley.service';
import { ShoppingTrolleyController } from './shopping-trolley.controller';
import { DatabaseModule } from '../database/database.module';
import { ProductScoreService } from '../recommendation/service/product-score.service';

@Module({
  imports: [DatabaseModule],
  providers: [ShoppingTrolleyService, ProductScoreService],
  controllers: [ShoppingTrolleyController],
})
export class ShoppingTrolleyModule {}
