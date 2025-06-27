import { Module } from '@nestjs/common';
import { StyleService } from './style.service';
import { StyleController } from './style.controller';
import { DatabaseModule } from '../database/database.module';
import { ProductItemModule } from '../product-item/product-item.module';

@Module({
  controllers: [StyleController],
  providers: [StyleService],
  imports: [DatabaseModule, ProductItemModule],
})
export class StyleModule {}
