import { Module } from '@nestjs/common';
import { ProductItemService } from './product-item.service';
import { ProductItemController } from './product-item.controller';

@Module({
  exports: [ProductItemService],
  controllers: [ProductItemController],
  providers: [ProductItemService],
})
export class ProductItemModule {}
