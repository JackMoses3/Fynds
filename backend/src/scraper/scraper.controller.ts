import { Controller, Get } from '@nestjs/common';
import { ScraperService, ProductData } from './scraper.service';

@Controller('scraper')
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) {}

  // Single endpoint to scrape both men's and women's product URLs from H&M
  @Get('combined')
  async scrapeCombined(): Promise<ProductData[]> {
    const mensListingUrl = 'https://www2.hm.com/en_gb/men/products/view-all.html';
    const womensListingUrl = 'https://www2.hm.com/en_gb/women/products/view-all.html';
    return this.scraperService.scrapeCombinedCategories(mensListingUrl, womensListingUrl);
  }
}