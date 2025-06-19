/* eslint-disable @typescript-eslint/no-unsafe-argument */
import axios, { AxiosInstance } from 'axios';
import pMap from 'p-map';
import * as http from 'http';
import * as https from 'https';
import { XMLParser } from 'fast-xml-parser';
import puppeteer from 'puppeteer';
import { URL } from 'url';
import { PrismaClient } from '@prisma/client';
import type { SiteDataConfig } from 'generated/prisma';
import { BROWSER_HEADERS, inferSex, normalizeCategory } from '../utils/utils';

/* ------------------------------------------------------------------ */
/* 1. Axios instance with keep‑alive                                  */
/* ------------------------------------------------------------------ */
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });
const client: AxiosInstance = axios.create({
  timeout: 10000,
  headers: BROWSER_HEADERS,
  httpAgent,
  httpsAgent,
});

/* ------------------------------------------------------------------ */
/* 2.  Fallback fetch via Puppeteer (Cloudflare)                      */
/* ------------------------------------------------------------------ */
async function fetchViaPuppeteer(url: string): Promise<string> {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setUserAgent(BROWSER_HEADERS['User-Agent']);
  await page.setExtraHTTPHeaders({
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  });
  const resp = await page.goto(url, {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });
  if (!resp) throw new Error(`No response for ${url}`);
  const text = (await resp.text()).trim();
  await browser.close();
  return text;
}

/* ------------------------------------------------------------------ */
/* 3.  Sitemap reader                                                 */
/* ------------------------------------------------------------------ */
const xmlParser = new XMLParser({ ignoreAttributes: true });
export async function extractProductUrls(src: string): Promise<string[]> {
  let xml: string;
  try {
    xml = (await client.get<string>(src)).data;
  } catch {
    // fall back to puppeteer (Cloudflare gziped XML)
    xml = await fetchViaPuppeteer(src);
  }
  const parsed: any = xmlParser.parse(xml);
  const raw = parsed.urlset?.url;
  const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return Array.from(
    new Set(
      entries
        .map((e: any) => e.loc)
        .filter(
          (u: any): u is string => typeof u === 'string' && /\/p\//.test(u),
        ),
    ),
  );
}

/* ------------------------------------------------------------------ */
/* 4.  Build upsert payload                                           */
/* ------------------------------------------------------------------ */
interface UpsertPayload {
  where: { url: string };
  update: object;
  create: object;
}

export async function buildUpsert(
  pageUrl: string,
  config: SiteDataConfig,
): Promise<UpsertPayload | null> {
  const match = pageUrl.match(/\/p\/[^/]+\/([^/]+)\.html$/);
  if (!match) return null;
  const pid = match[1];
  const apiUrl = `https://www.lululemon.com.au/on/demandware.store/Sites-AU-Site/en_AU/Product-Variation?dwvar_${pid}&pid=${pid}&quantity=1`;

  let jsonText: string;
  try {
    jsonText = (await client.get<string>(apiUrl)).data;
  } catch {
    jsonText = await fetchViaPuppeteer(apiUrl);
  }

  let resp: any;
  try {
    resp = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;
  } catch {
    return null;
  }

  const product = resp.product ?? {};
  const priceInfo = resp.productPrice ?? {};
  const cat = resp.productCategory ?? {};

  const name: string = product.productName ?? product.name ?? '';
  const brand: string = product.brand ?? 'Lululemon';
  const price: number = priceInfo.displayPrice ?? 0;
  const sale: boolean = !!priceInfo.onSale;
  const category: string = normalizeCategory(
    cat.primaryCategory || cat.unifiedID || '',
  );
  const sex: string = inferSex(cat.unifiedID || '', []);
  const images: string[] = (resp.images?.['hi-res'] ?? [])
    .map((i: any) => i.url)
    .filter(Boolean);

  const base = {
    name,
    brand,
    price,
    sale,
    retailer: 'Lululemon',
    category,
    sex,
    metaData: '',
  };

  return {
    where: { url: pageUrl },
    update: {
      ...base,
    },
    create: {
      ...base,
      url: pageUrl,
      lastModified: null,
      siteDataConfigId: undefined,
      productImages: {
        createMany: { data: images.map((u) => ({ imageUrl: u })) },
      },
    },
  };
}

/* ------------------------------------------------------------------ */
/* 5.  Main entry – concurrent sync                                   */
/* ------------------------------------------------------------------ */
export async function handleLululemon(
  config: SiteDataConfig,
  prisma: PrismaClient,
): Promise<void> {
  const sources = config.siteMapUrl.flatMap((s) =>
    s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
  );
  const urlLists = await Promise.all(sources.map(extractProductUrls));
  const productUrls = Array.from(new Set(urlLists.flat()));
  console.log(`→ Lululemon: ${productUrls.length} products to sync`);

  const CONCURRENT = 6;
  await pMap(
    productUrls,
    async (url) => {
      try {
        const upsert = await buildUpsert(url, config);
        if (!upsert) return;
        (upsert.create as any).siteDataConfigId = config.id;
        await prisma.$transaction(
          (tx: { productItem: { upsert: (arg0: any) => any } }) =>
            tx.productItem.upsert(upsert as any),
        );
        console.log(`   • synced Lululemon ${url}`);
      } catch (err: any) {
        console.error(`   • failed ${url}:`, err.message || err);
      }
    },
    { concurrency: CONCURRENT },
  );

  console.log('✓ Lululemon sync complete');
}
