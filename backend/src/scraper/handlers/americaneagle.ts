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
/* 1.  Axios instance with keep-alive                                 */
/* ------------------------------------------------------------------ */
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

const client: AxiosInstance = axios.create({
  timeout: 10_000,
  headers: BROWSER_HEADERS,
  httpAgent,
  httpsAgent,
});

/* ------------------------------------------------------------------ */
/* 2.  HTML stripping utility                                        */
/* ------------------------------------------------------------------ */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ------------------------------------------------------------------ */
/* 3.  Lightweight sitemap reader                                     */
/* ------------------------------------------------------------------ */
const xmlParser = new XMLParser({
  ignoreAttributes: true,
  allowBooleanAttributes: false,
});

export async function extractProductUrls(src: string): Promise<string[]> {
  if (!src.endsWith('.xml')) return [src];

  console.log(`   • fetching sitemap ${src}`);
  const xml = (await client.get<string>(src)).data;
  const parsed: any = xmlParser.parse(xml);

  const urls: string[] = parsed.urlset?.url?.map((u: any) => u.loc) ?? [];

  return urls.filter((u) => typeof u === 'string' && u.includes('/product/'));
}

/* ------------------------------------------------------------------ */
/* 4.  One product fetch + transform                                  */
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
  const slug = new URL(pageUrl).pathname.split('/').pop()?.split('?')[0];
  if (!slug) return null;

  const origin = new URL(pageUrl).origin;
  const apiUrl = `${origin}/api/product/s/${slug}?lang=en&siteTag=AE_AU`;

  let data: any;
  try {
    data = (await client.get(apiUrl)).data;
  } catch (err: any) {
    console.error(`   • API fetch failed ${apiUrl}:`, err.message || err);
    return null;
  }
  if (!data) return null;

  const catString = (data.categories[0] ?? []).toLowerCase();
  if (
    catString.includes('accessories') ||
    catString.includes('sunglasses') ||
    catString.includes('bags') ||
    catString.includes('hats')
  ) {
    console.log(`   • skipping AE accessory: ${pageUrl}`);
    return null;
  }

  const name = data.name as string;
  const metaData = stripHtml(data.description as string);
  const price = Number(data.priceMin ?? 0);
  const listPrice = Number(data.priceRange?.listMax ?? price);
  const sale = price < listPrice;
  const images: string[] = Array.isArray(data.options?.[0]?.media?.large)
    ? (data.options[0].media.large as string[])
    : [];
  const videos: string[] =
    typeof data.videoUrl === 'string' ? [data.videoUrl] : [];
  const sex = inferSex(data.gender, (data.categories as string[]) ?? []);
  const category = normalizeCategory((data.categories || []).join(' '));

  const baseFields = {
    name,
    metaData,
    brand: 'American Eagle',
    price,
    standardPrice: listPrice,
    sale,
    retailer: 'American Eagle',
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
        createMany: { data: videos.map((url) => ({ videoUrl: url })) },
      },
    },
  };
}

/* ------------------------------------------------------------------ */
/* 5.  Main entry – concurrent sync                                   */
/* ------------------------------------------------------------------ */

export async function handleAmericanEagle(
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
  const productUrls = [...new Set(urlSets.flat())];
  console.log(`→ American Eagle: ${productUrls.length} products to sync`);

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
        console.log(`   • synced AE ${pageUrl}`);
      } catch (err: any) {
        console.error(`   • failed ${pageUrl}:`, err.message || err);
      }
    },
    { concurrency: CONCURRENT },
  );

  console.log('✓ American Eagle sync complete');
}
