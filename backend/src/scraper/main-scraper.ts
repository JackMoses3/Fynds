import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ScraperService } from './scraper.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const scraperService = app.get(ScraperService);

  const urls = [
    "https://www.gluestore.com.au/collections/womens-clothing",
    "https://www.gluestore.com.au/collections/mens-clothing",
    "https://www.asos.com/men/t-shirts-vests/cat/?cid=7616",
    "https://www.culturekings.com.au/collections/new-arrivals",
    "https://www.theiconic.com.au/mens-clothing/",
    "https://www2.hm.com/en_au/men/products/view-all.html",
    "https://www.industrie.com.au/collections/all",
    "https://www.universalstore.com/collections/mens-clothing",
    "https://www.generalpants.com/collections/mens-clothing",
    "https://fasttimes.com.au/apparel/top-picks",
  ];

  for (const url of urls) {
    console.log(`🚀 Starting scrape for: ${url}`);
    try {
      await scraperService.scrapeAndSaveSingleSite(url);
    } catch (err) {
      console.error(`❌ Failed to scrape ${url}`, err);
    }
  }

  await app.close();
}

bootstrap();

