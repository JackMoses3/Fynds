/* eslint-disable @typescript-eslint/no-unsafe-argument */
import axios, { AxiosInstance } from 'axios';
import pMap from 'p-map';
import http from 'http';
import https from 'https';
import { XMLParser } from 'fast-xml-parser';
import type { PrismaClient, SiteDataConfig } from '@prisma/client';
import { BROWSER_HEADERS, inferSex, normalizeCategory } from '../utils/utils';

/* ------------------------------------------------------------------ */
/* 1.  Axios instance with keep-alive                                 */
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
/* 2.  Sitemap reader                                                  */
/* ------------------------------------------------------------------ */
const xmlParser = new XMLParser({ ignoreAttributes: true, allowBooleanAttributes: false });
export async function extractProductUrls(src: string): Promise<string[]> {
    if (!src.endsWith('.xml')) return [src];
    console.log(`   • fetching sitemap ${src}`);
    const xml = (await client.get<string>(src)).data;
    const parsed = xmlParser.parse(xml) as any;
    const urls: string[] = parsed.urlset?.url?.map((u: { loc: string }) => u.loc) ?? [];
    return urls.filter((u) => u.includes('/p/'));
}

/* ------------------------------------------------------------------ */
/* 3.  Build upsert payload                                           */
/* ------------------------------------------------------------------ */
interface UpsertPayload { where: { url: string }; update: object; create: object; }

export async function buildUpsert(pageUrl: string, config: SiteDataConfig,): Promise<UpsertPayload | null> {
    // extract productId from URL suffix
    const match = pageUrl.match(/_(\d+)(?:$|\?)/);
    if (!match) return null;
    const productId = match[1];

    // 2 API calls
    const metaUrl = `https://online-orchestrator.mango.com/v4/products?countryIso=AU&channelId=shop&languageIso=en&productId=${productId}`;
    const priceUrl = `https://online-orchestrator.mango.com/v3/prices/products?countryIso=AU&channelId=shop&productId=${productId}`;

    let meta: any, priceData: any;
    try { meta = (await client.get(metaUrl)).data; }
    catch (err) { console.error(`   • metadata fetch failed ${metaUrl}:`, err); return null; }

    try { priceData = (await client.get(priceUrl)).data; }
    catch (err) { console.error(`   • price fetch failed ${priceUrl}:`, err); return null; }

    // locate product object
    if (!meta) return null;

    const lowerUrl = meta.url.toLowerCase();
    const excluded = ['shoes', 'accessories', 'bags', 'jewelry'];
    if (excluded.some((kw) => lowerUrl.includes(kw))) {
        console.log(`   • skipping ${pageUrl} (excluded category)`);
        return null;
    }

    // core fields
    const name: string = meta.name;
    const metaData: string = '';
    const brand: string = 'Mango';
    const rawCat: string = meta.url;
    const category = normalizeCategory(rawCat);
    const sex = inferSex(rawCat, [meta.name]);
    // else leave sex as undefined

    // pricing
    // pricing
    // mango v3 prices API returns an array under `data`
    const priceEntries: any[] = Object.values(priceData).map((entry) => (entry as any).price);
    // extract each variant's price
    const price = priceEntries.length ? Math.min(...priceEntries) : 0;
    const listPrice = priceEntries.length ? Math.max(...priceEntries) : 0;

    const sale = price < listPrice;



    // images
    // images: merge swatch + look images from meta.colors
    const images: string[] = [];
    const domain = meta.assetsDomain?.replace(/\/$/, '') || '';
    for (const color of meta.colors ?? []) {
        // look “00” images
        const look0 = color.looks?.['00']?.images;
        if (look0 && typeof look0 === 'object') {
            for (const key of Object.keys(look0)) {
                const entry = (look0 as any)[key];
                if (entry.img) images.push(domain + entry.img);
            }
        }
    }
    // dedupe
    const uniqueImages = Array.from(new Set(images));


    const baseFields = {
        name,
        metaData,
        brand,
        price,
        standardPrice: listPrice,
        sale,
        retailer: 'Mango',
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
            storeId: BigInt(productId),
            subCategory: null,
            lastModified: null,
            siteDataConfigId: undefined, // set in handler
            productImages: {
                createMany: { data: uniqueImages.map((imageUrl) => ({ imageUrl })) },
            },
        },
    };
}

/* ------------------------------------------------------------------ */
/* 4.  Main entry – concurrent sync                                    */
/* ------------------------------------------------------------------ */
export async function handleMango(
    config: SiteDataConfig,
    prisma: PrismaClient,
): Promise<void> {
    const sitemaps = config.siteMapUrl
        .flatMap((s) => s.split(',').map((x) => x.trim()).filter(Boolean));

    const urlLists = await Promise.all(sitemaps.map(extractProductUrls));
    const productUrls = Array.from(new Set(urlLists.flat()));
    console.log(`→ Mango: ${productUrls.length} products to sync`);

    const CONCURRENT = 12;
    await pMap(
        productUrls,
        async (pageUrl) => {
            try {
                const upsertData = await buildUpsert(pageUrl, config);
                if (!upsertData) return;
                (upsertData.create as any).siteDataConfigId = config.id;
                await prisma.$transaction((tx) =>
                    tx.productItem.upsert(upsertData as any),
                );

                console.log(`   • synced ${pageUrl}`);
            } catch (err) {
                console.error(`   • failed ${pageUrl}:`, (err as Error).message);
            }
        },
        { concurrency: CONCURRENT },
    );

    console.log('✓ Mango sync complete');
}