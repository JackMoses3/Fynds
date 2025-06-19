/* eslint-disable @typescript-eslint/no-unsafe-argument */
import axios, { AxiosInstance } from 'axios';
import pMap from 'p-map';
import { XMLParser } from 'fast-xml-parser';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import { PrismaClient } from '@prisma/client';
import type { SiteDataConfig } from 'generated/prisma';
import { BROWSER_HEADERS, inferSex, normalizeCategory } from '../utils/utils';

const JSON_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

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
/* 2.  Excluded categories                                            */
/* ------------------------------------------------------------------ */
const EXCLUDED = [
  'accessories',
  'shoes',
  'hats',
  'apartment',
  'home',
  'skin',
  'skincare',
  'beauty',
  'makeup',
  'hair',
  'lifestyle',
  'music',
  'intimates',
  'cross',
];

/* ------------------------------------------------------------------ */
/* 3.  Sitemap reader                                                 */
/* ------------------------------------------------------------------ */
const xmlParser = new XMLParser({
  ignoreAttributes: true,
  allowBooleanAttributes: false,
});

export async function extractProductUrls(src: string): Promise<string[]> {
  if (!src.endsWith('.xml')) return [src];

  console.log(`   • fetching sitemap ${src}`);
  const xml = (await client.get<string>(src)).data;
  const parsed = xmlParser.parse(xml) as any;
  const urls: string[] =
    parsed.urlset?.url?.map((u: { loc: string }) => u.loc) ?? [];
  return urls;
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
): Promise<UpsertPayload[] | null> {
  const { pathname } = new URL(pageUrl);
  const sku = pathname.split('/').pop() || '';
  if (!/^UO-\d+-\d+$/.test(sku)) return null;

  const apiUrl = `https://au.urbanoutfitters.com/api/product/s/${sku}?lang=en&siteTag=UO_AU`;
  let data: any;
  try {
    data = (await client.get(apiUrl, { headers: JSON_HEADERS })).data;
  } catch {
    return null;
  }

  const rawCat =
    Array.isArray(data.categories) && data.categories.length
      ? data.categories[0]
      : '';
  const lowerCat = rawCat.toLowerCase();
  const hasExcluded = EXCLUDED.some((kw) => lowerCat.includes(kw));
  const hasDigit = /\d/.test(rawCat);
  if (hasExcluded || hasDigit) return null;

  const name = data.name as string;
  const metaData = (data.description || '').replace(/<[^>]+>/g, ' ').trim();
  const brand = data.brand?.name || 'Urban Outfitters';
  const category = normalizeCategory(rawCat);
  const sex = inferSex(rawCat, []);

  const colorVariants = data.options || [];
  const images: string[] = [];
  const videos: string[] = [];
  const variantPayloads: UpsertPayload[] = [];

  for (const colourOpt of colorVariants) {
    const colourSlug = colourOpt.slug as string;
    const allList =
      colourOpt.options?.map((sz: any) => sz.price?.list?.total ?? 0) || [];
    const allSale =
      colourOpt.options?.map((sz: any) => sz.price?.sale?.total ?? 0) || [];
    if (!allList.length) continue;

    const minList = Math.min(...allList);
    const minSale = Math.min(...allSale.filter((s: number) => s > 0));
    const isOnSale = minSale > 0 && minSale < minList;
    const price = isOnSale ? minSale : minList;
    const variantUrl = `${pageUrl}?color=${encodeURIComponent(colourSlug)}`;

    const imgs = colourOpt.media?.large ?? [];
    const vids = colourOpt.media?.video ?? [];

    variantPayloads.push({
      where: { url: variantUrl },
      update: {
        name,
        metaData,
        brand,
        price,
        standardPrice: minList,
        sale: isOnSale,
        retailer: 'Urban Outfitters',
        category,
        sex,
      },
      create: {
        url: variantUrl,
        name,
        metaData,
        brand,
        price,
        standardPrice: minList,
        sale: isOnSale,
        retailer: 'Urban Outfitters',
        category,
        sex,
        lastModified: null,
        siteDataConfigId: undefined, // set in handler
        productImages: { create: imgs.map((u: string) => ({ imageUrl: u })) },
        itemVideos: { create: vids.map((u: string) => ({ videoUrl: u })) },
      },
    });
  }

  return variantPayloads.length ? variantPayloads : null;
}

/* ------------------------------------------------------------------ */
/* 5.  Main entry – concurrent sync                                   */
/* ------------------------------------------------------------------ */
export async function handleUrban(
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
  const productUrls = [...new Set(urlLists.flat())];
  console.log(`→ Urban: ${productUrls.length} URLs to process`);

  const CONCURRENT = 12;
  await pMap(
    productUrls,
    async (pageUrl) => {
      try {
        const payloads = await buildUpsert(pageUrl, config);
        if (!payloads) return;

        for (const upsertData of payloads) {
          (upsertData.create as any).siteDataConfigId = config.id;
          await prisma.$transaction(
            (tx: { productItem: { upsert: (arg0: any) => any } }) =>
              tx.productItem.upsert(upsertData as any),
          );
          console.log(`   • synced ${upsertData.where.url}`);
        }
      } catch (err) {
        console.error(`   • failed ${pageUrl}:`, (err as Error).message);
      }
    },
    { concurrency: CONCURRENT },
  );
  console.log('✓ Urban sync complete');
}
