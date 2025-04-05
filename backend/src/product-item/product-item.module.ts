import { Module } from '@nestjs/common';
import { ProductItemService } from './product-item.service';
import { ProductItemController } from './product-item.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  exports: [ProductItemService],
  controllers: [ProductItemController],
  providers: [ProductItemService],
  imports: [DatabaseModule],
})
export class ProductItemModule {}
