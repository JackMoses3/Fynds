// src/handlers/shopify.ts

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import pMap from 'p-map';
import { XMLParser } from 'fast-xml-parser';
import http from 'http';
import https from 'https';
import type { PrismaClient, SiteDataConfig } from '@prisma/client';
import {
    inferSex,
    normalizeCategory,
    JSON_HEADERS,
} from '../utils/utils';

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
    retries = 4,
    baseDelay = 4000,
): Promise<AxiosResponse<T>> {
    let lastError: any;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            if (attempt > 0) await delay(Math.random() * 100);
            const response = await client.get<T>(url, config);
            if (attempt > 0) {
                console.info(`   • fetched ${url} on attempt ${attempt + 1}`);
            }
            return response;
        } catch (err: any) {
            lastError = err;
            if (
                axios.isAxiosError(err) &&
                err.response?.status === 429 &&
                attempt < retries
            ) {
                const retryAfter = err.response.headers['retry-after'];
                const wait = retryAfter
                    ? parseFloat(retryAfter) * 1000
                    : baseDelay * 5 ** attempt;
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
export async function extractProductUrls(sitemapUrl: string): Promise<string[]> {
    console.log(`   • fetching sitemap ${sitemapUrl}`);
    const response = await fetchWithRetry<string>(sitemapUrl);
    const parsed = xmlParser.parse(response.data) as any;
    const entries = parsed.urlset?.url ?? [];
    return entries
        .map((e: any) =>
            typeof e.loc === 'string'
                ? e.loc
                : Array.isArray(e.loc)
                    ? e.loc[0]
                    : ''
        )
        .filter((u: string) => u.includes('/products/'));
}

/* ------------------------------------------------------------------ */
/* 5. One product fetch + transform                                   */
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
    if (!pageUrl.includes('/products/')) return null;

    const jsUrl = `${pageUrl}.js`;
    let productJson: any;
    try {
        const res = await fetchWithRetry<Record<string, any>>(jsUrl, {
            headers: JSON_HEADERS,
        });
        productJson = res.data;
    } catch (err: any) {
        if (axios.isAxiosError(err) && err.response?.status === 404) {
            console.warn(`   • skipping missing JS for ${jsUrl}`);
            return null;
        }
        console.error(`   • failed fetching ${jsUrl}:`, err.message);
        return null;
    }

    const type = (productJson.type ?? '').toLowerCase();
    const accessoryKeywords = [
        'accessories', 'socks', 'bags', 'belts', 'hats', 'caps',
        'scarves', 'gloves', 'jewelry', 'watches', 'sunglasses',
        'wallets', 'ties', 'headbands', 'keyrings', 'headwear', 'gifts'
    ];
    if (accessoryKeywords.some(kw => type.includes(kw))) {
        console.log(`   • skipping Shopify accessory: ${pageUrl}`);
        return null;
    }

    const tags: string[] = Array.isArray(productJson.tags)
        ? productJson.tags
        : [];
    const category = normalizeCategory(`${type} ${tags.join(' ')}`);
    const title = productJson.title as string;
    const rawDesc = (productJson.description as string) ?? '';
    const metaData = rawDesc
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const price = (productJson.price_min as number) / 100;
    const compareAtRaw = productJson.compare_at_price;
    const compareAt =
        compareAtRaw === '' || compareAtRaw == null
            ? price
            : (compareAtRaw as number) / 100;

    const sale = compareAt !== price;

    const images: string[] = (productJson.media ?? [])
        .filter((m: any) => m.media_type === 'image')
        .map((m: any) => m.src)
        .filter(Boolean);

    const videos: string[] = (productJson.media ?? [])
        .map((m: any) => m.alt)
        .filter((alt: any) => typeof alt === 'string' && alt.endsWith('.mp4'));


    const baseData = {
        sex: inferSex(`${type} ${config.retailerName}`, tags),
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
        lastModified: productJson.updated_at
            ? new Date(productJson.updated_at)
            : null,
        siteDataConfigId: config.id,
    };

    return {
        where: { url: pageUrl },
        update: {
            ...baseData,
        },
        create: {
            ...baseData,
            productImages: {
                create: images.map(src => ({ imageUrl: src })),
            },
            itemVideos: {
                create: videos.map(url => ({ videoUrl: url })),
            },
        },
    };
}

/* ------------------------------------------------------------------ */
/* 6. Transaction‐safe upsert with retry                              */
/* ------------------------------------------------------------------ */
async function safeUpsert<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (e: any) {
            if (
                e.message.includes('Unable to start a transaction') &&
                i < retries - 1
            ) {
                const wait = 40 * 4 ** i;
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
/* 7. Modified Shopify handler: sequential per-sitemap                */
/* ------------------------------------------------------------------ */
export async function handleShopify(
    config: SiteDataConfig,
    prisma: PrismaClient,
): Promise<void> {
    const sitemaps = config.siteMapUrl
        .map((s: string) => s.trim())
        .filter(Boolean);

    const INTER_SITEMAP_DELAY_MS = 30_000;  // 30s between files
    const CONCURRENT = 4;

    for (const sitemapUrl of sitemaps) {
        console.log(`→ Shopify: fetching ${sitemapUrl}`);
        const productUrls = await extractProductUrls(sitemapUrl);
        console.log(`→ Shopify: ${productUrls.length} URLs from ${sitemapUrl}`);

        await pMap(
            productUrls,
            async pageUrl => {
                await delay(Math.random() * 300);
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
            { concurrency: CONCURRENT }
        );

        console.log(`✓ Finished sitemap ${sitemapUrl}`);
        console.log(`⏱ Waiting ${INTER_SITEMAP_DELAY_MS / 1000}s before next…`);
        await delay(INTER_SITEMAP_DELAY_MS);
    }

    console.log('✓ Shopify sync complete');
}
