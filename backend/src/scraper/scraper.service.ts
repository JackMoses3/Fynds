import { Page } from 'puppeteer';
import { ScraperConfig, ProductData } from './scraper.types';
import { ProductItemService } from '../product-item/product-item.service';
import { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import * as path from 'path';
const puppeteer = require("puppeteer");
const fs = require("fs");

@Injectable()
export class ScraperService {
  // importing productItemService 
  constructor(private readonly productItemService: ProductItemService) { }
  private static websiteConfigs: { [key: string]: ScraperConfig } = {
    "asos.com": {
      retailer: "ASOS",
      productLinksSelector: "a.productLink_KM4PI",
      loadMoreSelector: "a.loadButton_wWQ3F",
      waitSelector: ".gallery-image",
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
      //currentPageSelector: "li.ais-Pagination-item--selected",
      //nextPageSelector: "li.ais-Pagination-item--nextPage a.ais-Pagination-link",
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
      loadMoreSelector: 'button[data-elid="pagination-hybrid-button"]',
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
      nextPageSelector: "li.current + li a.ga-track-link-click",
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
    },
    "cottonon.com": {
      retailer: "Cotton On",
      productLinksSelector: "a.thumb-link",
      loadMoreSelector: "a.load-more-btn.button.primary.hollow",
      noContext: true,
      imageScraper: async (page: Page): Promise<string[]> => {
        return await page.evaluate(() => {
          const links = document.querySelectorAll('li.thumb a[href]') as NodeListOf<HTMLAnchorElement>;
          return [...links].map(a => a.href);
        });
      },
      priceExtractor: (productData) => {
        return productData.price || "";
      }
    },
    "factorie.com.au": {
      retailer: "Factorie",
      productLinksSelector: "a.product-tile__image-link",
      loadMoreSelector: "a.load-more-btn.button.primary.hollow",
      noContext: true,
      imageScraper: async (page: Page): Promise<string[]> => {
        return await page.evaluate(() => {
          const images = document.querySelectorAll('img.media-source');
          const urls = [...images].map(img => (img as HTMLImageElement).src);
          return urls;
        });
      },
      priceExtractor: (productData) => {
        return productData.price || "";
      }
    },
    "princesspolly.com.au": {
      retailer: "Princess Polly",
      productLinksSelector: 'a.product_tile__image-link',
      currentPageSelector: 'span.paginate__link--active',
      nextPageSelector: 'button.paginate__link[data-page-num]',
      imageScraper: async (page: Page): Promise<string[]> => {
        return await page.evaluate(() => {
          const imageDivs = document.querySelectorAll('div.product__zoom');
          const urls = [...new Set(
            [...imageDivs]
              .map(div => div.getAttribute('data-product-detail-zoom'))
              .filter((url): url is string => !!url)
          )];
          return urls;
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
    const allLinks = new Set<string>();
    const MAX_PRODUCTS = 3000;

    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const getLinks = async () => {
      const links = config.productLinkExtractor
        ? await config.productLinkExtractor(page)
        : await page.$$eval(config.productLinksSelector, anchors =>
          anchors.map(a => new URL((a as HTMLAnchorElement).href, window.location.origin).href)
        );
      links.forEach(link => {
        if (allLinks.size < MAX_PRODUCTS) allLinks.add(link);
      });
    };

    if (config.loadMoreSelector) {
      let loadMoreVisible = true;
      await getLinks(); // first batch

      while (loadMoreVisible && allLinks.size < MAX_PRODUCTS) {
        const prevSize = allLinks.size;
        const start = Date.now();

        while (Date.now() - start < 20000) { // max 20s retry window
          const loadMoreButton = await page.$(config.loadMoreSelector);
          if (!loadMoreButton) {
            loadMoreVisible = false;
            break;
          }

          try {
            await loadMoreButton.click();
            await wait(3000); // wait for new products to load
            await getLinks();

            if (allLinks.size > prevSize) {
              break; // ✅ new products found, exit inner retry loop
            }
          } catch (err) {
            console.warn("⚠️ Error clicking Load More or waiting:", err);
            break;
          }
        }

        const newSize = allLinks.size;
        if (newSize === prevSize) {
          console.warn("⏳ No new links after retries. Stopping load more loop.");
          break;
        }
      }
    }

    else if (config.nextPageSelector && config.currentPageSelector) {
      while (allLinks.size < MAX_PRODUCTS) {
        await page.waitForSelector(config.currentPageSelector);

        const nextPage = await page.$(config.nextPageSelector);
        if (!nextPage) break;

        try {
          await nextPage.click();
          await wait(3000);
          await getLinks();
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
    await page.goto(url, { waitUntil: "networkidle2", timeout: 90000 });

    const sex = url.toLowerCase().includes("women") || url.toLowerCase().includes("woman") || url.toLowerCase().includes("princess")
      ? "women"
      : url.toLowerCase().includes("men") || url.toLowerCase().includes("man")
        ? "men"
        : "men";

    const domain = new URL(url).hostname.replace("www.", "");

    // ✅ Sanitize file name to avoid ENOENT errors on Windows
    const safeFilename = url.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const linksDir = path.join(__dirname, 'product-links');
    const linksFilePath = path.join(linksDir, `${safeFilename}.${sex}.json`);
    const progressFilePath = path.join(linksDir, `${safeFilename}.${sex}.progress.json`);

    // ✅ Ensure folder exists
    if (!fs.existsSync(linksDir)) {
      fs.mkdirSync(linksDir, { recursive: true });
    }

    let currentIndex = 0;

    if (fs.existsSync(progressFilePath)) {
      try {
        const progress = JSON.parse(fs.readFileSync(progressFilePath, 'utf-8'));
        currentIndex = progress.currentIndex || 0;
      } catch {
        currentIndex = 0;
      }
    }

    let productLinks: string[];

    if (fs.existsSync(linksFilePath)) {
      productLinks = JSON.parse(fs.readFileSync(linksFilePath, 'utf-8'));
      console.log(`🔁 Loaded ${productLinks.length} product links from file: ${linksFilePath}`);
    } else {
      productLinks = await this.autoPaginate(page, config) as string[];
      fs.writeFileSync(linksFilePath, JSON.stringify(productLinks, null, 2), 'utf-8');
      console.log(`💾 Saved ${productLinks.length} product links to file: ${linksFilePath}`);
    }

    console.log(`🔗 Found ${productLinks.length} product links on ${url}`);

    const BATCH_SIZE = 5;
    const RESTART_BROWSER_INTERVAL = 200;

    while (currentIndex < productLinks.length) {
      try {
        if (currentIndex > 0 && currentIndex % RESTART_BROWSER_INTERVAL === 0) {
          await browser.close();
          browser = await puppeteer.launch({ headless: false, protocolTimeout: 120000 });
        }

        const batch = productLinks.slice(currentIndex, currentIndex + BATCH_SIZE);
        let batchIndex = 0;

        await Promise.allSettled(batch.map(async (link) => {
          let productPage;
          const thisIndex = currentIndex + batchIndex;
          batchIndex++;

          try {
            productPage = await browser.newPage();
            await new Promise(resolve => setTimeout(resolve, 100 * batchIndex)); // stagger opening
            await productPage.goto(link, { waitUntil: "domcontentloaded", timeout: 60000 });

            if (config.waitSelector) {
              await productPage.waitForSelector(config.waitSelector, { timeout: 5000 }).catch(() => { });
            }

            const rawImageUrls = await config.imageScraper(productPage);
            const imageUrls = rawImageUrls.map(url =>
              url.startsWith('http') ? url : `https:${url}`
            );

            let productData: ProductData | undefined;

            if (!config.noContext) {
              const jsonLDs: Record<string, any>[] = await productPage.$$eval(
                'script[type="application/ld+json"]',
                (scripts: HTMLScriptElement[]) =>
                  scripts
                    .map((s: HTMLScriptElement) => {
                      try {
                        return JSON.parse(s.textContent || "") as Record<string, any>;
                      } catch {
                        return null;
                      }
                    })
                    .filter((item): item is Record<string, any> => Boolean(item))
              );

              productData = jsonLDs.find((ld: Record<string, any>): ld is ProductData => {
                const type = ld["@type"];
                return typeof type === "string"
                  ? type.toLowerCase().includes("product")
                  : Array.isArray(type) && type.some((t: string) => t.toLowerCase().includes("product"));
              });
            }

            if (!productData && config.noContext) {
              productData = await productPage.evaluate(() => {
                try {
                  // @ts-ignore
                  const dataLayerArr = window.dataLayerArr || [];
                  const product = dataLayerArr[0]?.ecommerce?.detail?.products?.[0];

                  if (product) {
                    return { ...product, "@type": "Product" }; // ✅ add @type to satisfy TypeScript
                  }
                } catch (e) {
                  console.warn("⚠️ Failed to parse productData from dataLayerArr", e);
                }

                return null;
              });
            }


            if (!productData) {
              console.warn("❌ No product data found for:", link);
              return;
            }


            const productInfo = {
              retailer: config.retailer,
              name: productData.name || "",
              brand: typeof productData.brand === 'object' && 'name' in productData.brand
                ? productData.brand.name
                : productData.brand || config.retailer,
              price: config.priceExtractor(productData),
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
              url: productInfo.url,
              metaData: productInfo.description,
              retailer: productInfo.retailer,
              imageUrls: productInfo.imageUrls,
            });

            console.log("✅ Added to DB:", productInfo.name);
          } catch (err) {
            console.error(`❌ Error scraping product (${link}):`, err);
          } finally {
            if (productPage) await productPage.close();
          }
        }));

        currentIndex += BATCH_SIZE;
        fs.writeFileSync(progressFilePath, JSON.stringify({ currentIndex }), "utf-8");
      } catch (batchError) {
        console.error("💥 Batch failed, restarting browser and resuming...", batchError);
        try {
          await browser.close();
        } catch (e) {
          console.warn("⚠️ Error closing browser:", e);
        }
        browser = await puppeteer.launch({
          headless: false,
          protocolTimeout: 180000,
          timeout: 180000,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
      }
    }

    await page.close();
    if (fs.existsSync(progressFilePath)) {
      fs.unlinkSync(progressFilePath);
    }
  }



  async scrapeAndSaveSingleSite(url: string) {
    const domain = new URL(url).hostname.replace("www.", "");
    const config = ScraperService.websiteConfigs[domain];

    if (!config) {
      throw new Error(`No scraping configuration found for domain: ${domain}`);
    }

    const browser = await puppeteer.launch({ headless: false, protocolTimeout: 120000 });
    await this.scrapeWebsite(url, config, browser);
    await browser.close();
  }
}
/*
      "https://www.asos.com/men/t-shirts-vests/cat/?cid=7616",
      "https://www.gluestore.com.au/collections/womens-clothing",
      "https://www.gluestore.com.au/collections/mens-clothing",
      "https://www.culturekings.com.au/collections/new-arrivals",
      "https://www.theiconic.com.au/mens-clothing/",
      "https://www2.hm.com/en_au/men/products/view-all.html",
      "https://www.industrie.com.au/collections/all",
      "https://www.universalstore.com/collections/mens-clothing",
      "https://www.generalpants.com/collections/mens-clothing",
      "https://fasttimes.com.au/apparel/top-picks",
*/