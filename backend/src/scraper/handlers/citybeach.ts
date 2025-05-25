/* eslint-disable @typescript-eslint/no-unsafe-argument */
import axios, { AxiosInstance } from 'axios';
import * as zlib from 'zlib';
import pMap from 'p-map';
import { XMLParser } from 'fast-xml-parser';
import { URL } from 'url';
import { PrismaClient, SiteDataConfig } from '@prisma/client';
import { BROWSER_HEADERS, inferSex, normalizeCategory } from '../utils/utils';

const JSON_HEADERS = {
    ...BROWSER_HEADERS,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
};

/* ------------------------------------------------------------------ */
/* 1.  Axios instance with keep-alive                                 */
/* ------------------------------------------------------------------ */
const httpAgent = new (require('http').Agent)({ keepAlive: true });
const httpsAgent = new (require('https').Agent)({ keepAlive: true });

const client: AxiosInstance = axios.create({
    headers: BROWSER_HEADERS,
    timeout: 10_000,
    httpAgent,
    httpsAgent,
});

/* ------------------------------------------------------------------ */
/* 2.  Sitemap reader (handles .xml and .gz)                          */
/* ------------------------------------------------------------------ */
const xmlParser = new XMLParser({ ignoreAttributes: true, allowBooleanAttributes: false });

async function extractProductUrls(src: string): Promise<string[]> {
    let xml: string;
    if (src.endsWith('.gz')) {
        const resp = await client.get<ArrayBuffer>(src, { responseType: 'arraybuffer', headers: BROWSER_HEADERS });
        xml = zlib.gunzipSync(Buffer.from(resp.data)).toString('utf-8');
    } else {
        xml = (await client.get<string>(src)).data;
    }

    const trimmed = xml.trim();
    if (!trimmed.includes('<urlset')) return [];

    const parsed: any = xmlParser.parse(trimmed);
    const urls: string[] = parsed.urlset?.url?.map((u: any) => u.loc) ?? [];
    return urls.filter((u) => typeof u === 'string' && /\/\d+-\d+\.html$/.test(u));
}

/* ------------------------------------------------------------------ */
/* 3.  Build upsert payload                                          */
/* ------------------------------------------------------------------ */
interface UpsertPayload {
    where: { url: string };
    update: object;
    create: object;
}

async function buildUpsert(pageUrl: string): Promise<UpsertPayload | null> {
    const match = pageUrl.match(/\/(\d+-\d+)\.html$/);
    if (!match) return null;
    const variantId = match[1];

    const origin = new URL(pageUrl).origin;
    const variationUrl = `${origin}/on/demandware.store/Sites-CityBeachAustralia-Site/default/Product-Variation?dwvar_${variantId}_color=&pid=${variantId}&quantity=1`;

    let p: any;
    try {
        const resp = await client.get<{ product: any }>(variationUrl, { headers: JSON_HEADERS });
        p = resp.data.product;
    } catch (err: any) {
        console.error(`   • API fetch failed ${variationUrl}:`, err.message || err);
        return null;
    }

    // infer
    const rawSex = Array.isArray(p.productTypelvl0) ? p.productTypelvl0[0] : '';
    const sex = inferSex(rawSex, []);

    // skip non-clothing
    if (!Array.isArray(p.productTypelvl1) || !p.productTypelvl1.includes('Clothing')) {
        console.log(`   • skipping non-clothing ${pageUrl}`);
        return null;
    }

    const categoryRaw = Array.isArray(p.productTypelvl3) ? p.productTypelvl3[0] : '';
    const category = normalizeCategory(categoryRaw);

    const price = parseFloat(p.customProps?.currentPrice) || parseFloat(p.price?.sales?.value) || 0;
    const listPrice = parseFloat(p.price?.listMax || price.toString());
    const sale = price < listPrice;

    const images: string[] = Array.isArray(p.images?.large)
        ? p.images.large.map((img: any) => img.url)
        : [];
    const videos: string[] = Array.isArray(p.videos)
        ? p.videos.map((v: any) => v.videoUrl).filter((u: string) => !!u)
        : [];

    const name = p.productName;
    const brand = p.brand;
    const metaData = p.customProps?.webDescription || '';

    const baseFields = { name, brand, category, sex, price, standardPrice: listPrice, sale, retailer: 'City Beach', metaData };

    return {
        where: { url: pageUrl },
        update: {
            ...baseFields,
            productImages: { deleteMany: {}, createMany: { data: images.map((u) => ({ imageUrl: u })) } },
            itemVideos: { deleteMany: {}, createMany: { data: videos.map((u) => ({ videoUrl: u })) } },
        },
        create: {
            ...baseFields,
            url: pageUrl,
            storeId: null,
            subCategory: null,
            lastModified: null,
            siteDataConfigId: undefined,
            productImages: { createMany: { data: images.map((u) => ({ imageUrl: u })) } },
            itemVideos: { createMany: { data: videos.map((u) => ({ videoUrl: u })) } },
        },
    };
}

/* ------------------------------------------------------------------ */
/* 4.  Main entry – concurrent sync                                   */
/* ------------------------------------------------------------------ */
export async function handleCityBeach(
    config: SiteDataConfig,
    prisma: PrismaClient
): Promise<void> {
    const sources = config.siteMapUrl
        .flatMap((raw) => raw.split(',').map((s) => s.trim()).filter(Boolean));

    const urlSets = await Promise.all(sources.map(extractProductUrls));
    const productUrls = Array.from(new Set(urlSets.flat()));
    console.log(`→ City Beach: ${productUrls.length} products to sync`);

    const CONCURRENCY = 12;
    await pMap(
        productUrls,
        async (pageUrl) => {
            try {
                const upsertData = await buildUpsert(pageUrl);
                if (!upsertData) return;
                (upsertData.create as any).siteDataConfigId = config.id;
                await prisma.$transaction((tx) => tx.productItem.upsert(upsertData as any));
                console.log(`   • synced CityBeach ${pageUrl}`);
            } catch (err: any) {
                console.error(`   • failed ${pageUrl}:`, err.message || err);
            }
        },
        { concurrency: CONCURRENCY }
    );

    console.log('✓ CityBeach sync complete');
}
