import { Module } from '@nestjs/common';
import { ScraperController } from './scraper.controller';
import { ScraperService } from './scraper.service';
import { ProductItemModule } from '../product-item/product-item.module';

@Module({
    imports: [ProductItemModule],
    exports: [ScraperService],
    controllers: [ScraperController],
    providers: [ScraperService],
})
export class ScraperModule {}