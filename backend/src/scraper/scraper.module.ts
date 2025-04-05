import { Module } from '@nestjs/common';
import { ScraperController } from './scraper.controller';
import { ScraperService } from './scraper.service';

@Module({
    exports: [ScraperService],
    controllers: [ScraperController],
    providers: [ScraperService],
})
export class ScraperModule {}