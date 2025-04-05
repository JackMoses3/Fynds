import { Page } from 'puppeteer';
import { ScraperConfig, ProductData } from './scraper.types';
import { ProductItemService } from 'src/product-item/product-item.service';
import { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
const puppeteer = require("puppeteer");
const fs = require("fs");

@Injectable()
export class ScraperService {
  // importing productItemService 
  constructor(private readonly productItemService: ProductItemService) {}
  private static websiteConfigs: { [key: string]: ScraperConfig} = {
    "asos.com": {
      retailer: "ASOS",
      productLinksSelector: "a.productLink_KM4PI",
      loadMoreSelector: "a.loadButton_wWQ3F",
      imageScraper: async (page) => {
        return await page.evaluate(() => {
          const highResImages = [...document.querySelectorAll('.gallery-image')]
            .flatMap(img =>
              (img.getAttribute('srcset') || '')
                .split(',')
                .map(s => s.trim().split(' ')[0])
            )
            .filter(url => url.includes("1920w") && url.includes("wid=1926"));
          return [...new Set(highResImages)];
        });
      },
      priceExtractor: (productData) => {
        if (Array.isArray(productData.offers)) {
          const offer = productData.offers.find(o => o.price);
          return offer?.price || "";
        }
        return (productData.offers as { price?: string })?.price || "";
      }
    },

    "gluestore.com.au": {
      retailer: "Glue Store",
      productLinksSelector: "div.image__container.product__imageContainer a[href]",
      loadMoreSelector: "button.ais-InfiniteHits-loadMore",
      imageScraper: async (page) => {
        return await page.evaluate(async () => {
          const path = window.location.pathname;
          const res = await fetch(path + ".js");
          const data = await res.json();
          return data.images || [];
        });
      },
      priceExtractor: (productData) => {
        if (Array.isArray(productData.offers)) {
          const offer = productData.offers.find(o => o.price);
          return offer?.price || "";
        }
        return productData.offers?.price || "";
      }
    },

    "fasttimes.com.au": {
      retailer: "Fast Times",
      productLinksSelector: ".product-item a",
      loadMoreSelector: "button.amscroll-load-button",
      imageScraper: async (page) => {
        return await page.evaluate(() =>
          [...document.querySelectorAll('.fotoramastageframe img')].map(img => (img as HTMLImageElement).src)
        );
      },
      priceExtractor: (productData) => {
        if (Array.isArray(productData.offers)) {
          const offer = productData.offers.find(o => o.price);
          return offer?.price || "";
        }
        return productData.offers?.price || "";
      }
    },

    "generalpants.com": {
      retailer: "General Pants",
      productLinksSelector: ".grid__item.ss__result.ss__result--item a.full-unstyled-link.pdp-image-link",
      loadMoreSelector: "#load-more-products",
      imageScraper: async (page) => {
        return await page.evaluate(async () => {
          const path = window.location.pathname;
          const res = await fetch(path + ".js");
          const data = await res.json();
          return data.images || [];
        });
      },
      priceExtractor: (productData) => {
        const variants = productData.hasVariant;
        if (Array.isArray(variants)) {
          const offer = variants[0]?.offers;
          if (Array.isArray(offer)) {
            return offer[0]?.price || "";
          }
          return offer?.price || "";
        }
        return "";
      }
    }, 
    "industrie.com.au": {
      retailer: "Industrie",
      productLinksSelector: "article.ss__result.product-card.ss__result--item a",
      currentPageSelector: "a.ss__pagination__link",
      nextPageSelector: "a.ss__pagination__link",
      imageScraper: async (page) => {
        return await page.evaluate(async () => {
          const path = window.location.pathname;
          const res = await fetch(path + ".js");
          const data = await res.json();
          return data.images || [];
        });
      },
      priceExtractor: (productData) => {
        if (Array.isArray(productData.offers)) {
          return productData.offers[0]?.price || "";
        }
        return productData.offers?.price || "";
      }
    },
    "universalstore.com": {
      retailer: "Universal Store",
      productLinksSelector: "a.product-featured-image-link.aspect-ratio.aspect-ratio--adapt",
      loadMoreSelector: "button.load-more.button",
      imageScraper: async (page) => {
        return await page.evaluate(async () => {
          const path = window.location.pathname;
          const res = await fetch(path + ".js");
          const data = await res.json();
          return data.images || [];
        });
      },
      priceExtractor: (productData) => {
        if (Array.isArray(productData.offers)) {
          return productData.offers[0]?.price || "";
        }
        return productData.offers?.price || "";
      }
    }, 
    "www2.hm.com": {
      retailer: "H&M",
      productLinksSelector: "a[href*='/productpage']",
      loadMoreSelector: "button.f05bd4.aaa2a2.ab0e07",
      imageScraper: async (page) => {
        const jsonLDs = await page.$$eval('script[type="application/ld+json"]', scripts =>
          scripts.map(s => {
            try {
              return JSON.parse(s.textContent || "");
            } catch {
              return null;
            }
          }).filter(Boolean)
        );
      
        const product = jsonLDs.find(ld =>
          typeof ld["@type"] === "string" && ld["@type"].toLowerCase().includes("product")
        );
      
        const images = Array.isArray(product?.image)
          ? product.image
          : product?.image
            ? [product.image]
            : [];
      
        return images;
      },
      priceExtractor: (productData) => {
        if (Array.isArray(productData.offers)) {
          return productData.offers[0]?.price || "";
        }
        return productData.offers?.price || "";
      }    
    },
    "theiconic.com.au": {
    retailer: "THE ICONIC",
    productLinksSelector: "a.product-image-link",
    currentPageSelector: "li.current",
    nextPageSelector: "li.arrow a[href*='?page=']",
    imageScraper: async (page): Promise<string[]> => {
      return await page.evaluate(() => {
        const fullsizeImages = [...new Set(
          [...document.querySelectorAll('a[data-ti-fullsizable]')]
            .map(a => a.getAttribute('data-ti-fullsizable'))
        )].filter((url): url is string => url !== null); // Filter out null values
        return fullsizeImages;
      });
    },
    priceExtractor: (productData) => {
      if (Array.isArray(productData.offers)) {
        const inStockOffer = productData.offers.find(
          (offer) =>
            offer.availability &&
            !offer.availability.toLowerCase().includes("outofstock") &&
            offer.price
        );
        return inStockOffer?.price || "";
      }
      return productData.offers?.price || "";
    }  
  }, 
  "culturekings.com.au": {
    retailer: "Culture Kings",
    productLinksSelector: "a.ProductHit_slider__OBw4P",
    imageScraper: async (page) => {
      return await page.evaluate(async () => {
        const path = window.location.pathname;
        const res = await fetch(path + ".js");
        const data = await res.json();
        return data.images || [];
      });
    },
    priceExtractor: (productData) => {
      if (Array.isArray(productData.offers)) {
        return productData.offers[0]?.price || "";
      }
      return productData.offers?.price || "";
    }
  }
  };

  private async autoPaginate(page: Page, config: ScraperConfig) {
    const allLinks = new Set();

    // Helper to extract product links from the current page
    const getLinks = async () => {
      const links = config.productLinkExtractor
        ? await config.productLinkExtractor(page)
        : await page.$$eval(config.productLinksSelector, anchors =>
            anchors.map(a => new URL((a as HTMLAnchorElement).href, window.location.origin).href)
          );
      links.forEach(link => allLinks.add(link));
    };

    // Case 1: "Load More" button exists
    if (config.loadMoreSelector) {
      let loadMoreVisible = true;
      await getLinks(); // Get links from first page
      while (loadMoreVisible) {
        const loadMoreButton = await page.$(config.loadMoreSelector);
        if (!loadMoreButton) break;
        try {
          await loadMoreButton.click();
          await new Promise(resolve => setTimeout(resolve, 3000));
          await getLinks(); // Get links from new page
        } catch (e) {
          console.warn("⚠️ Error clicking Load More:", e);
          break;
        }
      }
    }

    // Case 2: Page-based navigation (next/prev)
    else if (config.nextPageSelector && config.currentPageSelector) {
      while (true) {
        // Wait to ensure current page is fully rendered
        await page.waitForSelector(config.currentPageSelector);

        const nextPage = await page.$(config.nextPageSelector);
        if (!nextPage) break;

        try {
          await nextPage.click()
          await new Promise(resolve => setTimeout(resolve, 3000));
          await getLinks(); // Get links from next page
        } catch (e) {
          console.warn("⚠️ Error clicking Next Page:", e);
          break;
        }
      }
    }
    return Array.from(allLinks);
  }

  private async scrapeWebsite(url: string, config: ScraperConfig, browser: any) {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2" });

    const productLinks  = await this.autoPaginate(page, config); //function to get all product links then load next page/button

    console.log(`🔗 Found ${productLinks.length} product links on ${url}`);
    
    // Loop through each product link and scrape data
    for (const link of productLinks) {
      try {
        const productPage = await browser.newPage();
        await productPage.goto(link, { waitUntil: "domcontentloaded" });
        // get all of the image, URLs
        const imageUrls = await config.imageScraper(productPage);
        
        // get all of the JSON-LD data
        const jsonLDs: Array<Record<string, any>> = await productPage.$$eval(
          'script[type="application/ld+json"]',
          (scripts: HTMLScriptElement[]): Array<Record<string, any>> =>
            scripts
          .map((s: HTMLScriptElement) => {
            try {
              return JSON.parse(s.textContent || "") as Record<string, any>;
            } catch {
              return null;
            }
          })
          .filter((json): json is Record<string, any> => Boolean(json))
        );

        // find the product data in the JSON-LD
        const productData = jsonLDs.find(ld => {
          const type = ld["@type"];
          return typeof type === "string"
            ? type.toLowerCase().includes("product")
            : Array.isArray(type) && type.some(t => t.toLowerCase().includes("product"));
        });
        // if no product data is found, log a warning and skip the product
        if (!productData) {
          console.warn("❌ No product data found for:", link);
          await productPage.close();
          continue;
        }

        const sex = url.toLowerCase().includes("women") || url.toLowerCase().includes("woman")
          ? "women"
          : url.toLowerCase().includes("men") || url.toLowerCase().includes("man")
            ? "men"
            : "men";

        const productInfo = {
          retailer: config.retailer,
          name: productData.name || "",
          brand: productData.brand?.name || productData.brand || config.retailer,
          price: config.priceExtractor(productData as ProductData),
          url: link,
          description: productData.description || "",
          imageUrls,
          sex,
        };

        await this.productItemService.createProductWithImages({
          name: productInfo.name,
          brand: productInfo.brand,
          sex: productInfo.sex,
          price: parseFloat(productInfo.price) || 0,
          url: productInfo.url as string,
          metaData: productInfo.description,
          retailer: productInfo.retailer,
          imageUrls: productInfo.imageUrls,
        });
        console.log("✅ Added to DB:", productInfo.name);

        // Go to the next product page
        await productPage.close();

      } catch (err) {
        console.error(`❌ Error scraping product (${link}):`, err);
      }
    }

    await page.close();
  }

  async scrapeAndSaveSingleSite(url: string) {
    const domain = new URL(url).hostname.replace("www.", "");
    const config = ScraperService.websiteConfigs[domain];

    if (!config) {
      throw new Error(`No scraping configuration found for domain: ${domain}`);
    }

    const browser = await puppeteer.launch({ headless: false });
    await this.scrapeWebsite(url, config, browser);
    await browser.close();
  }
}
/*
      "https://www.gluestore.com.au/collections/mens-clothing",
      "https://www.asos.com/men/t-shirts-vests/cat/?cid=7616",
      "https://www.culturekings.com.au/collections/new-arrivals",
      "https://www.theiconic.com.au/mens-clothing/",
      "https://www2.hm.com/en_au/men/products/view-all.html",
      "https://www.industrie.com.au/collections/all",
      "https://www.universalstore.com/collections/mens-clothing",
      "https://www.generalpants.com/collections/mens-clothing",
      "https://fasttimes.com.au/apparel/top-picks",
*/