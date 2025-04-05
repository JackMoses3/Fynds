import { Page } from 'puppeteer';

export interface ProductData {
    "@type": string | string[];
    name?: string;
    brand?: { name: string } | string;
    description?: string;
    image?: string[] | string;
    offers?: {
      price?: string;
      availability?: string;
    } | {
      price?: string;
      availability?: string;
    }[];
    hasVariant?: {
      offers: {
        price?: string;
      } | {
        price?: string;
      }[];
    }[];
  }


export interface ScraperConfig {
    retailer: string;
    productLinksSelector: string;
    loadMoreSelector?: string;
    currentPageSelector?: string;
    nextPageSelector?: string;
    productLinkExtractor?: (page: Page) => Promise<string[]>;
    imageScraper: (page: Page) => Promise<string[]>;
    priceExtractor: (productData: ProductData) => string;
  }