/* eslint-disable @typescript-eslint/no-unsafe-argument */
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import pMap from 'p-map';
import { XMLParser } from 'fast-xml-parser';
import * as http from 'http';
import * as https from 'https';
import { PrismaClient, SiteDataConfig } from '@prisma/client';
import { BROWSER_HEADERS, inferSex, normalizeCategory } from '../utils/utils';

const JSON_HEADERS = {
    'Content-Type': 'application/json',
    ...BROWSER_HEADERS,
};

/* ------------------------------------------------------------------ */
/* 1. Axios instance with keep-alive                                 */
/* ------------------------------------------------------------------ */
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });
const client: AxiosInstance = axios.create({
    timeout: 10000,
    httpAgent,
    httpsAgent,
});

/* ------------------------------------------------------------------ */
/* 2. Delay helper                                                   */
/* ------------------------------------------------------------------ */
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/* ------------------------------------------------------------------ */
/* 3. Retry helper for 429s with Retry-After                         */
/* ------------------------------------------------------------------ */
async function fetchWithRetry<T>(
    url: string,
    config: AxiosRequestConfig = {},
    retries = 5,
    baseDelay = 2000,
): Promise<AxiosResponse<T>> {
    let lastError: any;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            if (attempt > 0) {
                const jitter = Math.random() * 10;
                await delay(jitter);
            }
            const response = await client.get<T>(url, config);
            if (attempt > 0) {
                console.info(`   • fetched ${url} on attempt ${attempt + 1}`);
            }
            return response;
        } catch (err: any) {
            lastError = err;
            if (axios.isAxiosError(err) && err.response?.status === 429 && attempt < retries) {
                const retryAfter = err.response.headers['retry-after'];
                const wait = retryAfter
                    ? parseFloat(retryAfter) * 30
                    : baseDelay * 2 ** attempt;
                console.warn(
                    `   • rate limited on ${url}, retrying in ${wait}ms (attempt ${attempt + 1})`
                );
                await delay(wait);
                continue;
            }
            break;
        }
    }
    throw lastError || new Error(`Failed to fetch ${url}`);
}

/* ------------------------------------------------------------------ */
/* 4. Sitemap reader                                                  */
/* ------------------------------------------------------------------ */
const xmlParser = new XMLParser({ ignoreAttributes: true });
async function extractProductUrls(sitemapUrl: string): Promise<string[]> {
    console.log(`   • fetching sitemap ${sitemapUrl}`);
    const response = await fetchWithRetry<string>(sitemapUrl);
    const parsed = xmlParser.parse(response.data) as any;
    const entries = parsed.urlset?.url ?? [];
    return entries
        .map((e: any) =>
            typeof e.loc === 'string' ? e.loc : Array.isArray(e.loc) ? e.loc[0] : ''
        )
        .filter((u: string) => u && u.includes('/products/'));
}

/* ------------------------------------------------------------------ */
/* 5. One product fetch + transform                                   */
/* ------------------------------------------------------------------ */
interface UpsertPayload {
    where: { url: string };
    update: object;
    create: object;
}
async function buildUpsert(
    pageUrl: string,
    config: SiteDataConfig,
): Promise<UpsertPayload | null> {
    // skip any non-product URL
    if (!pageUrl.includes('/products/')) return null;

    const jsUrl = `${pageUrl}.js`;
    let productJson: any;
    try {
        const res = await fetchWithRetry<Record<string, any>>(jsUrl, { headers: JSON_HEADERS });
        productJson = res.data;
    } catch (err: any) {
        if (axios.isAxiosError(err) && err.response?.status === 404) {
            console.warn(`   • skipping missing JS for ${jsUrl}`);
            return null;
        }
        console.error(`   • failed fetching ${jsUrl}:`, err.message);
        return null;
    }

    const type = productJson.type ?? '';
    // list every keyword you consider “accessory”
    const accessoryKeywords = [
        'accessories', 'socks', 'bags', 'belts', 'hats', 'caps',
        'scarves', 'gloves', 'jewelry', 'watches', 'sunglasses',
        'wallets', 'ties', 'headbands', 'keyrings', 'headwear'
    ];

    const lowerType = (type ?? '').toLowerCase();

    if (accessoryKeywords.some(kw => lowerType.includes(kw))) {
        console.log(`   • skipping COS accessory: ${pageUrl}`);
        return null;
    }


    const tags: string[] = Array.isArray(productJson.tags) ? productJson.tags : [];
    const category = normalizeCategory(`${type} ${tags.join(' ')}`);

    const title = productJson.title as string;
    const rawDesc = (productJson.description as string) ?? '';
    const metaData = rawDesc
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const price = (productJson.price_min as number) / 100;
    const compareAt = (productJson.compare_at_price as number) / 100;
    const sale = compareAt !== price;

    const images: string[] = (productJson.media ?? [])
        .filter((m: any) => m.media_type === 'image')
        .map((m: any) => m.src as string)
        .filter(Boolean);

    const baseData = {
        sex: inferSex(type, tags),
        name: title,
        url: pageUrl,
        metaData,
        retailer: config.retailerName,
        price,
        standardPrice: compareAt,
        sale,
        brand: productJson.vendor as string,
        storeId: BigInt(productJson.id),
        category,
        subCategory: null,
        lastModified: productJson.updated_at ? new Date(productJson.updated_at) : null,
        siteDataConfigId: config.id,
    };

    return {
        where: { url: pageUrl },
        update: {
            ...baseData,
            productImages: { deleteMany: {}, create: images.map(src => ({ imageUrl: src })) },
        },
        create: {
            ...baseData,
            productImages: { create: images.map(src => ({ imageUrl: src })) },
        },
    };
}

/* ------------------------------------------------------------------ */
/* 6. Transaction-safe upsert with retry                              */
/* ------------------------------------------------------------------ */
async function safeUpsert(
    fn: () => Promise<any>,
    retries = 3,
): Promise<any> {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (e: any) {
            if (
                e.message.includes('Unable to start a transaction') &&
                i < retries - 1
            ) {
                const wait = 20 * 2 ** i;
                console.warn(
                    `   • transaction timeout, retrying in ${wait}ms (attempt ${i + 1})`
                );
                await delay(wait);
                continue;
            }
            throw e;
        }
    }
    throw new Error('Upsert failed after retries');
}

/* ------------------------------------------------------------------ */
/* 7. Main entry – concurrent sync                                    */
/* ------------------------------------------------------------------ */
export async function handleShopify(
    config: SiteDataConfig,
    prisma: PrismaClient,
): Promise<void> {
    const sitemaps = config.siteMapUrl
        .flatMap(s => s.split(',').map(x => x.trim()).filter(Boolean));
    const urlLists = await Promise.all(sitemaps.map(extractProductUrls));
    const productUrls = Array.from(new Set(urlLists.flat()));
    console.log(`→ Shopify: ${productUrls.length} URLs to process`);

    const CONCURRENT = 12;
    await pMap(
        productUrls,
        async pageUrl => {
            await delay(Math.random() * 5);
            try {
                const upsertData = await buildUpsert(pageUrl, config);
                if (!upsertData) return;
                await safeUpsert(() =>
                    prisma.$transaction(tx => tx.productItem.upsert(upsertData as any))
                );
                console.log(`   • synced ${pageUrl}`);
            } catch (err: any) {
                console.error(`   • failed ${pageUrl}:`, err.message);
            }
        },
        { concurrency: CONCURRENT },
    );
    console.log('✓ Shopify sync complete');
}