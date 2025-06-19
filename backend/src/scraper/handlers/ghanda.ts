/* eslint-disable @typescript-eslint/no-unsafe-argument */
import axios, { AxiosInstance } from 'axios';
import pMap from 'p-map';
import * as http from 'http';
import * as https from 'https';
import { XMLParser } from 'fast-xml-parser';
import { URL } from 'url';
import { PrismaClient } from '@prisma/client';
import type { SiteDataConfig } from 'generated/prisma';
import { BROWSER_HEADERS, inferSex, normalizeCategory } from '../utils/utils';

/* ------------------------------------------------------------------ */
/* 1. Axios instance with keep-alive                                 */
/* ------------------------------------------------------------------ */
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });
const client: AxiosInstance = axios.create({
  headers: BROWSER_HEADERS,
  timeout: 10_000,
  httpAgent,
  httpsAgent,
});

/* ------------------------------------------------------------------ */
/* 2. Sitemap reader                                                  */
/* ------------------------------------------------------------------ */
const xmlParser = new XMLParser({
  ignoreAttributes: true,
  allowBooleanAttributes: false,
});
export async function extractProductUrls(src: string): Promise<string[]> {
  if (!src.endsWith('.xml')) return [src];
  console.log(`   • fetching sitemap ${src}`);
  let xml: string;
  try {
    xml = (await client.get<string>(src)).data;
  } catch (err: any) {
    console.error(`   • HTTP error fetching sitemap:`, err.message || err);
    return [];
  }
  let parsed: any;
  try {
    parsed = xmlParser.parse(xml.trim());
  } catch (err: any) {
    console.error(`   • XML parse error:`, err.message || err);
    return [];
  }
  const raw = parsed.urlset?.url;
  const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const urls = entries
    .map((e: any) => e.loc)
    .filter(
      (u: any): u is string => typeof u === 'string' && u.includes('/product/'),
    );
  return Array.from(new Set(urls));
}

/* ------------------------------------------------------------------ */
/* 3. Build upsert payload                                           */
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
  const { origin, pathname } = new URL(pageUrl);
  const slug = pathname.split('/').pop()?.split('?')[0] || null;
  if (!slug) return null;

  const BUILD_ID = 'sMQ5IyshhLw3_OzJOUOjL';
  const apiUrl = `${origin}/_next/data/${BUILD_ID}/en-US/product/${slug}.json`;
  let data: any;
  try {
    data = (await client.get(apiUrl)).data;
  } catch (err: any) {
    console.error(`   • API fetch failed ${apiUrl}:`, err.message || err);
    return null;
  }

  const p = data.pageProps?.product;
  if (!p) return null;
  if (p.tags?.includes('ACCESSORIES') || p.tags?.includes('KIDS')) {
    console.log(`   • skipping accessories/kids-only: ${pageUrl}`);
    return null;
  }

  const name: string = p.name;
  const metaData: string = p.description;
  const price: number = p.price?.value ?? 0;
  const listPrice: number = p.variants?.[0]?.listPrice ?? price;
  const sale: boolean = price < listPrice;
  const images: string[] = Array.isArray(p.images)
    ? p.images.map((i: any) => i.url).filter((u: any): u is string => !!u)
    : [];
  let video: string | null = p.videoUrl;
  if (video) {
    video = p.videoUrl.value;
  }

  const genderRaw: string = p.collections?.nodes?.[0]?.title ?? '';
  const sex: string = inferSex(genderRaw, []);
  const rawCat: string = `${p.productType} ${p.tags?.join(', ')}`;
  const category: string = normalizeCategory(rawCat);

  const baseFields = {
    name,
    metaData,
    brand: 'Ghanda',
    price,
    standardPrice: listPrice,
    sale,
    retailer: 'Ghanda',
    category,
    sex,
  };

  return {
    where: { url: pageUrl },
    update: {
      ...baseFields,
    },
    create: {
      ...baseFields,
      url: pageUrl,
      lastModified: null,
      siteDataConfigId: undefined,
      productImages: {
        createMany: { data: images.map((url) => ({ imageUrl: url })) },
      },
      itemVideos: {
        createMany: { data: video ? [{ videoUrl: video }] : [] },
      },
    },
  };
}

/* ------------------------------------------------------------------ */
/* 4. Main entry – concurrent sync                                    */
/* ------------------------------------------------------------------ */
export async function handleGhanda(
  config: SiteDataConfig,
  prisma: PrismaClient,
): Promise<void> {
  const sources = config.siteMapUrl.flatMap((raw) =>
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const urlSets = await Promise.all(sources.map(extractProductUrls));
  const productUrls = Array.from(new Set(urlSets.flat()));
  console.log(`→ Ghanda: ${productUrls.length} products to sync`);

  const CONCURRENT = 12;
  await pMap(
    productUrls,
    async (pageUrl) => {
      try {
        const upsertData = await buildUpsert(pageUrl, config);
        if (!upsertData) return;
        (upsertData.create as any).siteDataConfigId = config.id;
        await prisma.$transaction(
          (tx: { productItem: { upsert: (arg0: any) => any } }) =>
            tx.productItem.upsert(upsertData as any),
        );
        console.log(`   • synced Ghanda ${pageUrl}`);
      } catch (err: any) {
        console.error(`   • failed ${pageUrl}:`, err.message || err);
      }
    },
    { concurrency: CONCURRENT },
  );

  console.log('✓ Ghanda sync complete');
}
