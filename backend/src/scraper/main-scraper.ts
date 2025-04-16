import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ScraperService } from './scraper.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const scraperService = app.get(ScraperService);

  const urls = [
    //"https://www.gluestore.com.au/collections/womens-clothing",
    // general pants jackets done
    //   "https://www.generalpants.com/collections/mens-clothing-singlets",
    // "https://www.generalpants.com/collections/mens-t-shirts",
    // "https://www.generalpants.com/collections/mens-clothing-jeans",
    // "https://www.generalpants.com/collections/mens-shorts",
    // "https://www.generalpants.com/collections/mens-clothing-pants-chinos",
    // "https://www.generalpants.com/collections/mens-shirts",
    // "https://www.generalpants.com/collections/mens-clothing-jumpers-hoodies",
    // "https://www.generalpants.com/collections/womens-jeans",
    // "https://www.generalpants.com/collections/womens-dresses",
    // "https://www.generalpants.com/collections/womens-swimwear",
    // "https://www.generalpants.com/collections/womens-jackets-and-coats",
    // "https://www.generalpants.com/collections/womens-skirts",
    // "https://www.generalpants.com/collections/womens-shorts",
    // "https://www.generalpants.com/collections/womens-pants-leggings",
    //"https://www.generalpants.com/collections/womens-tops",
    //"https://www.generalpants.com/collections/womens-t-shirts",
    //"https://www.generalpants.com/collections/womens-jumpers-hoodies",
    //"https://www.generalpants.com/collections/womens-knitwear",
    //"https://www.generalpants.com/collections/womens-playsuits-jumpsuits",
    //"https://www.generalpants.com/collections/womens-shirts",
    //"https://www.generalpants.com/collections/womens-singlets-1",
    //"https://www.generalpants.com/collections/womens-two-piece-sets",
    //"https://www.universalstore.com/collections/mens-t-shirts",
    //"https://www.universalstore.com/collections/mens-shirts-polos",
    //"https://www.universalstore.com/collections/jerseys",
    //"https://www.universalstore.com/collections/mens-jeans",
    //"https://www.universalstore.com/collections/mens-pants",
    //"https://www.universalstore.com/collections/mens-shorts",
    //"https://www.universalstore.com/collections/mens-hoodies-jumpers",
    //"https://www.universalstore.com/collections/mens-jackets-coats",
    //"https://www.universalstore.com/collections/mens-singlets-muscle-tanks",
    //"https://fasttimes.com.au/apparel/t-shirts",
    // "https://fasttimes.com.au/apparel/shirts",
    // "https://fasttimes.com.au/apparel/jerseys",
    // "https://fasttimes.com.au/apparel/polos",
    // "https://fasttimes.com.au/apparel/pants",
    // "https://fasttimes.com.au/apparel/shorts",
    // "https://fasttimes.com.au/apparel/hoodies",
    // "https://fasttimes.com.au/apparel/crewnecks",
    // "https://fasttimes.com.au/apparel/knitwear",
    // "https://fasttimes.com.au/apparel/jackets",
    // "https://fasttimes.com.au/apparel/vests",
    //"https://www.asos.com/au/men/t-shirts-singlets/cat/?cid=7616#nlid=mw|clothing|shop+by+product|t-shirts+%26+singlets",
    //"https://www.asos.com/au/men/shirts/cat/?cid=3602",
    //"https://www.asos.com/au/men/shorts/cat/?cid=7078",
    //"https://www.asos.com/au/men/pants-chinos/cat/?cid=4910",
    //"https://www.asos.com/au/men/jackets-coats/cat/?cid=3606",
    //"https://www.asos.com/au/women/tops/cat/?cid=4169",
    //"https://www.asos.com/au/women/dresses/cat/?cid=8799",
    //"https://www.asos.com/au/women/skirts/cat/?cid=2639",
    //"https://www.asos.com/au/women/pants-leggings/cat/?cid=2640",
    //"https://www.asos.com/au/women/jumpers-cardigans/cat/?cid=2637",
    //"https://www.asos.com/au/women/coats-jackets/cat/?cid=2641",
    //"https://www.asos.com/au/women/swimwear-beachwear/cat/?cid=2238",
    //"https://www.universalstore.com/collections/womens-tops",
    //"https://www.universalstore.com/collections/womens-t-shirts",
    //"https://www.universalstore.com/collections/womens-shirts",
    //"https://www.universalstore.com/collections/womens-jeans",
    //"https://www.universalstore.com/collections/womens-pants",
    //"https://www.universalstore.com/collections/womens-skirts",
    //"https://www.universalstore.com/collections/womens-shorts",
    //"https://www.universalstore.com/collections/womens-jackets-coats",
    //"https://www.universalstore.com/collections/womens-hoodies-jumpers",
    //"https://www.theiconic.com.au/mens-clothing-coats-jackets/",
    //"https://www.theiconic.com.au/mens-clothing-jumpers-cardigans/",
    //"https://www.theiconic.com.au/mens-clothing-pants/",
    //"https://www.theiconic.com.au/mens-clothing-shirts-polos/",
    //"https://www.theiconic.com.au/mens-clothing-shorts/",
    //"https://www.theiconic.com.au/mens-clothing-sweats-hoodies/",
    //"https://www.theiconic.com.au/mens-clothing-tshirts-singlets/",
    //"https://www.theiconic.com.au/womens-clothing-coats-jackets/",
    //"https://www.theiconic.com.au/womens-clothing-dresses/",
    //"https://www.theiconic.com.au/womens-clothing-jeans/",
    //"https://www.theiconic.com.au/womens-clothing-jumpers-cardigans/",
    //"https://www.theiconic.com.au/womens-clothing-pants/",
    //"https://www.theiconic.com.au/womens-clothing-tops/?page=1&sort=popularity&category=16",
    //"https://www.theiconic.com.au/womens-clothing-shorts/",
    //"https://www.theiconic.com.au/womens-clothing-skirts/",
    //"https://www.theiconic.com.au/womens-clothing-swimwear/",
    //"https://www.theiconic.com.au/womens-clothing-tshirts-singlets/"
    //"https://www.gluestore.com.au/collections/womens-tops",
    //"https://www.gluestore.com.au/collections/womens-pants",
    //"https://www.gluestore.com.au/collections/womens-shorts",
    //"https://www.gluestore.com.au/collections/womens-skirts",
    //"https://www.gluestore.com.au/collections/womens-jeans",
    //"https://www.gluestore.com.au/collections/womens-sweats-hoods",
    //"https://www.gluestore.com.au/collections/womens-jackets",
    //"https://www.gluestore.com.au/collections/womens-swimwear"
    //"https://www.culturekings.com.au/collections/mens?HM[menu.categories]=Tops&page=1",
    //"https://www.culturekings.com.au/collections/mens?HM[menu.categories]=Bottoms&page=1",
    //"https://www.culturekings.com.au/collections/womens-tops",
    //"https://www.culturekings.com.au/collections/womens-bottoms",
    //"https://www2.hm.com/en_au/men/products/t-shirts-and-singlets.html",
    //"https://www2.hm.com/en_au/men/products/trousers.html",
    //"https://www2.hm.com/en_au/men/products/hoodies-sweatshirts.html",
    //"https://www2.hm.com/en_au/men/products/shirts.html",
    //"https://www2.hm.com/en_au/men/products/jeans.html",
    //"https://www2.hm.com/en_au/men/products/cardigans-jumpers.html",
    //"https://www2.hm.com/en_au/men/products/polos.html",
    //"https://www2.hm.com/en_au/men/products/shorts.html",
    //"https://www2.hm.com/en_au/men/products/swimwear.html",
    //"https://www2.hm.com/en_au/women/products/dresses.html",
    //"https://www2.hm.com/en_au/women/products/tops.html",
    //"https://www2.hm.com/en_au/women/products/shirts-and-blouses.html",
    //"https://www2.hm.com/en_au/women/products/jackets-and-coats.html",
    //"https://www2.hm.com/en_au/women/products/cardigans-and-jumpers.html",
    //"https://www2.hm.com/en_au/women/products/blazers-and-waistcoats.html",
    //"https://www2.hm.com/en_au/women/products/pants.html",
    //"https://www2.hm.com/en_au/women/products/jeans.html",
    //"https://www2.hm.com/en_au/women/products/shorts.html",
    //"https://www2.hm.com/en_au/women/products/skirts.html",
    //"https://www2.hm.com/en_au/women/products/hoodies-sweatshirts.html",
    //"https://factorie.com.au/mens-shopall/",
    //"https://factorie.com.au/womens-shopall/",
    //"https://cottonon.com/AU/co/men/?start=0&sz=60",
    //"https://www2.hm.com/en_au/women/products/swimwear.html",
    //"https://www.princesspolly.com.au/collections/bottoms",
    //"https://cottonon.com/AU/co/women/",
    "https://www.gluestore.com.au/collections/womens-clothing"

  ]

  for (const url of urls) {
    console.log(` Starting scrape for: ${url}`);
    try {
      await scraperService.scrapeAndSaveSingleSite(url);
    } catch (err) {
      console.error(` Failed to scrape ${url}`, err);
    }
  }

  await app.close();
}

bootstrap();

