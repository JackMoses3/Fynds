import { Controller, Get, Query } from '@nestjs/common';
import { ScraperService } from './scraper.service';

@Controller('scraper')
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) {}

  @Get('scrape-single')
  async scrapeSingleSite(@Query('url') url: string) {
    if (!url) {
      return { error: 'URL query parameter is required' };
    }

    try {
      const productCount = await this.scraperService.scrapeAndSaveSingleSite(url);
      return {
        message: `✅ Scraping completed for: ${url}`,
        productCount: productCount,
      };
    } catch (err) {
      console.error('❌ Scraping failed:', err);
      return { error: 'Failed to scrape the provided URL' };
    }
  }
}