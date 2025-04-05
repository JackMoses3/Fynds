import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { ScraperModule } from './scraper/scraper.module';
import { ProductItemModule } from './product-item/product-item.module';

@Module({
  imports: [DatabaseModule, ScraperModule, ProductItemModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
