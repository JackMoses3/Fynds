/* eslint-disable @typescript-eslint/no-unsafe-argument */
import axios, { AxiosInstance } from 'axios';
import pMap from 'p-map';
import * as http from 'http';
import * as https from 'https';
import { XMLParser } from 'fast-xml-parser';
import { URL } from 'url';
import { PrismaClient, SiteDataConfig } from '@prisma/client';
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
/* 2.  Sitemap reader                                                  */
/* ------------------------------------------------------------------ */
const xmlParser = new XMLParser({ ignoreAttributes: true, allowBooleanAttributes: false });

export async function extractProductUrls(src: string): Promise<string[]> {
    if (!src.endsWith('.xml')) return [src];

    console.log(`   • fetching sitemap ${src}`);
    const xml = (await client.get<string>(src)).data;
    const parsed: any = xmlParser.parse(xml);
    const raw = parsed.urlset?.url;
    const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];

    const urls: string[] = entries
        .map((u: any) => u.loc)
        .filter((u: any): u is string => typeof u === 'string' && u.includes('/en-au/'));

    return urls;
}

/* ------------------------------------------------------------------ */
/* 3.  Build upsert payload                                          */
/* ------------------------------------------------------------------ */
interface UpsertPayload {
    where: { url: string };
    update: object;
    create: object;
}

export async function buildUpsert(pageUrl: string, config: SiteDataConfig,): Promise<UpsertPayload | null> {
    // derive json endpoint path
    const { origin, pathname } = new URL(pageUrl);
    const enAuPrefix = '/en-au/';
    const uriPath = pathname.startsWith(enAuPrefix)
        ? pathname.slice(enAuPrefix.length)
        : pathname.replace(/^\//, '');

    const BUILD_ID = 'beed5f0d024af38eb18fc54186c2b1a3e604ec6d';
    const apiUrl = `${origin}/_next/data/${BUILD_ID}/en-au/${uriPath}.json`;

    let data: any;
    try {
        data = (await client.get(apiUrl)).data;
    } catch (err: any) {
        console.error(`   • API fetch failed ${apiUrl}:`, err.message || err);
        return null;
    }

    const p = data.pageProps?.blocks?.[1]?.product;
    if (!p) return null;

    // skip accessories
    if (p.categoryUri?.toLowerCase().includes('accessories')) {
        console.log(`   • skipping COS accessory: ${pageUrl}`);
        return null;
    }

    // extract fields
    const name: string = p.defaultName;
    const metaData: string = p.description;
    const brand: string = p.brandName ?? 'COS';
    const price: number = p.priceAsNumber;
    const listPrice: number = p.priceBeforeDiscountAsNumber ?? price;
    const sale: boolean = price < listPrice;

    const images: string[] = Array.isArray(p.mediaObjects)
        ? p.mediaObjects
            .map((obj: any) => obj.attributes?.media_original_url)
            .filter((url: string | undefined): url is string => Boolean(url))
        : [];

    // infer gender & category
    const genderSegment = uriPath.split('/')[0];
    const sex: string = inferSex(genderSegment, []);
    const rawCategory = `${name} ${p.categoryUri}`;
    const category: string = normalizeCategory(rawCategory);

    const baseFields = {
        name,
        metaData,
        brand,
        price,
        standardPrice: listPrice,
        sale,
        retailer: 'COS',
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
            storeId: null,
            subCategory: null,
            lastModified: null,
            siteDataConfigId: undefined,
            productImages: {
                createMany: { data: images.map((imageUrl) => ({ imageUrl })) },
            },
        },
    };
}

/* ------------------------------------------------------------------ */
/* 4.  Main entry – concurrent sync                                   */
/* ------------------------------------------------------------------ */
export async function handleCos(
    config: SiteDataConfig,
    prisma: PrismaClient
): Promise<void> {
    const sources = config.siteMapUrl
        .flatMap((raw) => raw.split(',').map((s) => s.trim()).filter(Boolean));

    const urlSets = await Promise.all(sources.map(extractProductUrls));
    const productUrls = Array.from(new Set(urlSets.flat()));
    console.log(`→ COS: ${productUrls.length} products to sync`);

    const CONCURRENT = 12;
    await pMap(
        productUrls,
        async (pageUrl) => {
            try {
                const upsertData = await buildUpsert(pageUrl, config);
                if (!upsertData) return;
                (upsertData.create as any).siteDataConfigId = config.id;
                await prisma.$transaction((tx) => tx.productItem.upsert(upsertData as any));
                console.log(`   • synced COS ${pageUrl}`);
            } catch (err: any) {
                console.error(`   • failed ${pageUrl}:`, err.message || err);
            }
        },
        { concurrency: CONCURRENT }
    );

    console.log('✓ COS sync complete');
}