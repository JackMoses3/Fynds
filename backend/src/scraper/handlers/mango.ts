/* eslint-disable @typescript-eslint/no-unsafe-argument */
import axios, { AxiosInstance } from 'axios';
import pMap from 'p-map';
import * as http from 'http';
import * as https from 'https';
import { XMLParser } from 'fast-xml-parser';
import { PrismaClient, SiteDataConfig } from '@prisma/client';
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
async function extractProductUrls(src: string): Promise<string[]> {
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

async function buildUpsert(pageUrl: string): Promise<UpsertPayload | null> {
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
    const rawCatSex: string = meta.url;
    const category = normalizeCategory(rawCatSex);
    const sex = inferSex(rawCatSex, []);

    // pricing
    // pricing
    // mango v3 prices API returns an array under `data`
    const priceEntries: any[] = Array.isArray(priceData.data) ? priceData.data : [];
    // extract each variant's price
    const prices = priceEntries
        .map((x) => typeof x.price === 'number' ? x.price : parseFloat(x.price || '0'))
        .filter((p) => !isNaN(p));
    const price: number = prices.length ? Math.min(...prices) : 0;

    // originals may be under `originalPrice` or fallback to `price`
    const originals = priceEntries
        .map((x) =>
            typeof x.originalPrice === 'number'
                ? x.originalPrice
                : (typeof x.price === 'number' ? x.price : parseFloat(x.price || '0'))
        )
        .filter((o) => !isNaN(o));
    const listPrice: number = originals.length ? Math.min(...originals, price) : price;

    const sale = price < listPrice;



    // images
    // images: merge swatch + look images from meta.colors
    const images: string[] = [];
    const domain = meta.assetsDomain?.replace(/\/$/, '') || '';
    for (const color of meta.colors ?? []) {
        // bullet/swatch
        if (color.bulletImg) {
            images.push(domain + color.bulletImg);
        }
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
            productImages: {
                deleteMany: {},
                createMany: { data: images.map((imageUrl) => ({ imageUrl })) },
            },
        },
        create: {
            ...baseFields,
            url: pageUrl,
            storeId: BigInt(productId),
            subCategory: null,
            lastModified: null,
            siteDataConfigId: undefined, // set in handler
            productImages: {
                createMany: { data: images.map((imageUrl) => ({ imageUrl })) },
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
                const upsertData = await buildUpsert(pageUrl);
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