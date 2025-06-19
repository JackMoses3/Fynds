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
/* 2.  Build-ID discovery (cached per run)                            */
/* ------------------------------------------------------------------ */
const buildId = '-I-Z6p0TI0xpbSwxedJpJ';

/* ------------------------------------------------------------------ */
/* 3.  Lightweight sitemap reader                                     */
/* ------------------------------------------------------------------ */
const xmlParser = new XMLParser({
  ignoreAttributes: true,
  allowBooleanAttributes: false,
});

async function extractProductUrls(src: string): Promise<string[]> {
  if (!src.endsWith('.xml')) return [src];

  console.log(`   • fetching sitemap ${src}`);
  const xml = (await client.get<string>(src)).data;
  const parsed = xmlParser.parse(xml);

  const urls: string[] =
    parsed.urlset?.url?.map((u: { loc: string }) => u.loc) ?? [];

  return urls.filter((u) => u.includes('/au/products/'));
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
  const { origin, pathname } = new URL(pageUrl);
  const auPrefix = '/au/';
  const uriPath = pathname.startsWith(auPrefix)
    ? pathname.slice(auPrefix.length)
    : pathname.replace(/^\//, '');

  const apiUrl = `${origin}/_next/data/${buildId}/au/${uriPath}.json`;

  const json = (await client.get(apiUrl)).data;
  const p = json?.pageProps?.serverProduct;
  if (!p) return null;

  // skip accessories
  if (p.productType?.includes('Axx')) return null;

  const name = p.title as string;
  const metaData = (p.descriptionHtml as string)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const brand = p.brandName ?? 'I Am Gia';
  const firstVar = p.variants?.edges?.[0]?.node;
  const price = firstVar ? +firstVar.price.amount : 0;
  const listPrice = firstVar?.compareAtPrice?.amount
    ? +firstVar.compareAtPrice.amount
    : price;
  const sale = price < listPrice;
  const sex = 'women';
  const category = normalizeCategory(p.productType);
  const images: string[] =
    p.images?.edges
      ?.map((e: { node?: { url?: string } }) => e.node?.url)
      ?.filter(Boolean) ?? [];

  /* create/update payload */
  const baseFields = {
    name,
    metaData,
    brand,
    price,
    standardPrice: listPrice,
    sale,
    retailer: 'I Am Gia',
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
      siteDataConfigId: undefined, // filled in handler
      productImages: {
        createMany: { data: images.map((u) => ({ imageUrl: u })) },
      },
    },
  };
}

/* ------------------------------------------------------------------ */
/* 5.  Main entry – concurrent sync                                   */
/* ------------------------------------------------------------------ */
export async function handleIAmGia(
  config: SiteDataConfig,
  prisma: PrismaClient,
): Promise<void> {
  const sources = config.siteMapUrl.flatMap((raw) =>
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

  /* gather every product URL from every sitemap first */
  const urlSets = await Promise.all(sources.map(extractProductUrls));
  const productUrls = [...new Set(urlSets.flat())];
  console.log(`→ IAmGia: ${productUrls.length} products to sync`);

  /* mapper runs ≤ CONCURRENT tasks at once */
  const CONCURRENT = 12;

  await pMap(
    productUrls,
    async (pageUrl) => {
      try {
        const upsertData = await buildUpsert(pageUrl, config);
        if (!upsertData) return;

        /* attach foreign key that depends on config */
        (upsertData.create as any).siteDataConfigId = config.id;

        await prisma.$transaction(
          (tx: { productItem: { upsert: (arg0: any) => any } }) =>
            tx.productItem.upsert(upsertData as any),
        );

        console.log(`   • synced ${pageUrl}`);
      } catch (err) {
        console.error(`   • failed ${pageUrl}:`, (err as Error).message);
      }
    },
    { concurrency: CONCURRENT },
  );

  console.log('✓ IAmGia sync complete');
}
