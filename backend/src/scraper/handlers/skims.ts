/* src/scrapers/skims.ts */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import axios, { AxiosInstance } from 'axios';
import * as zlib from 'zlib';
import pMap from 'p-map';
import { XMLParser } from 'fast-xml-parser';
import { URL } from 'url';
import { PrismaClient, SiteDataConfig } from '@prisma/client';
import { BROWSER_HEADERS, inferSex, normalizeCategory } from '../utils/utils';

/* ------------------------------------------------------------------ */
/* 1.  Axios instance with keep-alive                                 */
/* ------------------------------------------------------------------ */
const httpAgent = new (require('http').Agent)({ keepAlive: true });
const httpsAgent = new (require('https').Agent)({ keepAlive: true });

const JSON_HEADERS = {

    'Content-Type': 'application/json',
    ...BROWSER_HEADERS,
};

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
    return urls.filter((u) => typeof u === 'string' && u.includes('/products/'));
}

/* ------------------------------------------------------------------ */
/* Helper: extract first balanced JSON object from a string           */
/* ------------------------------------------------------------------ */
function extractJsonObject(raw: string): string | null {
    let depth = 0;
    let start = -1;
    for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (ch === '{') {
            if (depth === 0) start = i;
            depth++;
        } else if (ch === '}') {
            depth--;
            if (depth === 0 && start !== -1) {
                return raw.slice(start, i + 1);
            }
        }
    }
    return null;
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
    if (!pageUrl.includes('/products/')) return null;

    const apiUrl = `${pageUrl}?_data`;
    let dataObj: any;

    try {
        let raw = await client.get<string>(apiUrl, { responseType: 'text', headers: JSON_HEADERS }).then((r) => r.data);
        if (raw.startsWith(")]}'")) {
            raw = raw.slice(raw.indexOf('\n') + 1);
        }
        const jsonStr = extractJsonObject(raw);
        if (!jsonStr) throw new Error('Could not locate JSON object in response');
        dataObj = JSON.parse(jsonStr);
        if (typeof dataObj === 'string') {
            dataObj = JSON.parse(dataObj);
        }
    } catch (err: any) {
        console.error(`   • failed to fetch/parse ${apiUrl}:`, err.message);
        return null;
    }

    const p =
        dataObj.productGalleryData?.activeProduct;
    if (!p) {
        console.error(`   • unexpected JSON shape at ${apiUrl}`);
        return null;
    }

    // infer sex and category from tags or props
    const tagsArray: string[] = Array.isArray(dataObj.productTagsDowncaseArray) ? dataObj.productTagsDowncaseArray : [];
    const genderTag = tagsArray.find((t) => t.startsWith('filtergender:'));
    const sex: string = genderTag ? genderTag.split(':')[1].trim() : inferSex('', []);

    const styleTag = tagsArray.find((t) => t.startsWith('filterstyle:'));
    const rawCat = styleTag ? styleTag.split(':')[1].trim() : '';
    const category: string = normalizeCategory(rawCat);

    // extract name, brand, description
    const name: string = p.title;
    const metaData: String = dataObj.product?.description || '';
    const brand: string = 'Skims';

    // pricing
    const rawPrice = dataObj.minVariantPrice?.amount ?? '0';
    const price = Number(rawPrice);
    const rawList = dataObj.maxVariantPrice?.amount ?? rawPrice;
    const listPrice = Number(rawList);
    const sale = price < listPrice;



    // media: images & videos
    const pmImages = Array.isArray(dataObj.productMedia?.images) ? dataObj.productMedia.images : [];
    const images = pmImages.flatMap((m: any) => m.image?.url ? [m.image.url] : []);
    const videos = pmImages.flatMap((m: any) => Array.isArray(m.videos) ? m.videos.map((v: any) => v.url) : []);

    const baseFields = { name, brand, category, sex, price, standardPrice: listPrice, sale, retailer: 'Skims', metaData };

    return {
        where: { url: pageUrl },
        update: {
            ...baseFields,
            productImages: { deleteMany: {}, createMany: { data: images.map((u: string) => ({ imageUrl: u })) } },
            itemVideos: { deleteMany: {}, createMany: { data: videos.map((u: string) => ({ videoUrl: u })) } },
        },
        create: {
            ...baseFields,
            url: pageUrl,
            storeId: null,
            subCategory: null,
            lastModified: null,
            siteDataConfigId: undefined,
            productImages: { createMany: { data: images.map((u: string) => ({ imageUrl: u })) } },
            itemVideos: { createMany: { data: videos.map((u: string) => ({ videoUrl: u })) } },
        },
    };
}

/* ------------------------------------------------------------------ */
/* 4.  Main entry – concurrent sync                                   */
/* ------------------------------------------------------------------ */
export async function handleSkims(
    config: SiteDataConfig,
    prisma: PrismaClient
): Promise<void> {
    const sources = config.siteMapUrl
        .flatMap((raw) => raw.split(',').map((s) => s.trim()).filter(Boolean));

    const urlSets = await Promise.all(sources.map(extractProductUrls));
    const productUrls = Array.from(new Set(urlSets.flat()));
    console.log(`→ Skims: ${productUrls.length} products to sync`);

    const CONCURRENCY = 12;
    await pMap(
        productUrls,
        async (pageUrl) => {
            try {
                const upsertData = await buildUpsert(pageUrl);
                if (!upsertData) return;
                (upsertData.create as any).siteDataConfigId = config.id;
                await prisma.$transaction((tx) => tx.productItem.upsert(upsertData as any));
                console.log(`   • synced ${pageUrl}`);
            } catch (err: any) {
                console.error(`   • failed ${pageUrl}:`, err.message || err);
            }
        },
        { concurrency: CONCURRENCY }
    );

    console.log('✓ Skims sync complete');
}
