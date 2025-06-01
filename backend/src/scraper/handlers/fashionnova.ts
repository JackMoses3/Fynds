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
    headers: BROWSER_HEADERS,
    timeout: 10_000,
    httpAgent,
    httpsAgent,
});

/* ------------------------------------------------------------------ */
/* 2.  Extract first JSON blob from HTML                             */
/* ------------------------------------------------------------------ */
function extractFirstJson(str: string): string | null {
    const start = str.indexOf('{');
    if (start === -1) return null;
    let depth = 0;
    for (let i = start; i < str.length; i++) {
        if (str[i] === '{') depth++;
        else if (str[i] === '}') {
            depth--;
            if (depth === 0) return str.slice(start, i + 1);
        }
    }
    return null;
}

/* ------------------------------------------------------------------ */
/* 3.  Sitemap or feed reader                                         */
/* ------------------------------------------------------------------ */
const xmlParser = new XMLParser({ ignoreAttributes: true, allowBooleanAttributes: false });

export async function extractProductUrls(src: string): Promise<string[]> {
    console.log(`   • fetching sitemap ${src}`);
    let body: string;
    try {
        body = (await client.get<string>(src)).data.trim();
    } catch (err: any) {
        console.error(`   • HTTP error fetching sitemap:`, err.message || err);
        return [];
    }

    // plaintext feed
    if (!body.startsWith('<')) {
        console.log('   • detected text feed, parsing URLs');
        const parts = body.split(/\s+/);
        const urls = Array.from(new Set(
            parts.filter(tok => tok.startsWith('http') && tok.includes('/products/'))
        ));
        console.log(`   • extracted ${urls.length} URLs from text feed`);
        return urls;
    }

    // xml sitemap
    let parsed: any;
    try {
        parsed = xmlParser.parse(body);
    } catch (err: any) {
        console.error('   • XML parse error:', err.message || err);
        return [];
    }

    const raw = parsed.urlset?.url;
    const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const urls = Array.from(new Set(
        entries
            .map((u: any) => u.loc)
            .filter((u: any): u is string => typeof u === 'string' && u.includes('/products/'))
    ));
    console.log(`   • extracted ${urls.length} URLs from XML sitemap`);
    return urls;
}

/* ------------------------------------------------------------------ */
/* 4.  Build upsert payload                                          */
/* ------------------------------------------------------------------ */
interface UpsertPayload { where: { url: string }; update: object; create: object; }

export async function buildUpsert(pageUrl: string, config: SiteDataConfig,): Promise<UpsertPayload | null> {
    const apiUrl = `${pageUrl}?_data`;
    let raw: any;
    try {
        raw = (await client.get(apiUrl)).data;
    } catch (err: any) {
        console.error(`   • API fetch failed ${apiUrl}:`, err.message || err);
        return null;
    }

    let obj: any;
    if (typeof raw === 'object') obj = raw;
    else {
        const jsonText = extractFirstJson(raw);
        if (!jsonText) return null;
        try { obj = JSON.parse(jsonText); } catch { return null; }
    }

    const p = obj.product?.fragment;
    if (!p) return null;
    // skip accessories
    if (/(jewelry|sunglasses|accessories|bags|hats)/i.test(p.productType ?? '')) return null;

    const name = p.title as string;
    const metaData = p.description as string;
    const price = parseFloat(p.selectedVariant?.price.amount ?? '0');
    const listPrice = parseFloat(p.selectedVariant?.compareAtPrice?.amount ?? price.toString());
    const sale = price < listPrice;

    const images: string[] = Array.isArray(p.images?.nodes)
        ? p.images.nodes.map((n: any) => n.url).filter((u: any): u is string => typeof u === 'string')
        : [];

    const sex = inferSex(obj.division, obj.division);
    const category = normalizeCategory(p.productType as string);

    const baseFields = { name, metaData, brand: 'FashionNova', price, standardPrice: listPrice, sale, retailer: 'Fashion Nova', category, sex };

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
            productImages: { createMany: { data: images.map(i => ({ imageUrl: i })) } },
        },
    };
}

/* ------------------------------------------------------------------ */
/* 5.  Main entry – concurrent sync                                   */
/* ------------------------------------------------------------------ */
export async function handleFashionNova(
    config: SiteDataConfig,
    prisma: PrismaClient
): Promise<void> {
    const sources = config.siteMapUrl.flatMap(raw => raw.split(',').map(s => s.trim()).filter(Boolean));
    const urlSets = await Promise.all(sources.map(extractProductUrls));
    const productUrls = Array.from(new Set(urlSets.flat()));
    console.log(`→ FashionNova: ${productUrls.length} products to sync`);

    const CONCURRENT = 12;
    await pMap(productUrls, async (pageUrl) => {
        try {
            const upsertData = await buildUpsert(pageUrl, config);
            if (!upsertData) return;
            (upsertData.create as any).siteDataConfigId = config.id;
            await prisma.$transaction(tx => tx.productItem.upsert(upsertData as any));
            console.log(`   • synced FashionNova ${pageUrl}`);
        } catch (err: any) {
            console.error(`   • failed ${pageUrl}:`, err.message || err);
        }
    }, { concurrency: CONCURRENT });

    console.log('✓ FashionNova sync complete');
}