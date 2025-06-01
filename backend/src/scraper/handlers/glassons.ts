/* eslint-disable @typescript-eslint/no-unsafe-argument */
import axios, { AxiosInstance } from 'axios';
import pMap from 'p-map';
import * as http from 'http';
import * as https from 'https';
import { parseStringPromise } from 'xml2js';
import { URL } from 'url';
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
export async function extractProductUrls(fromUrl: string): Promise<string[]> {
    if (!fromUrl.endsWith('.xml')) return [fromUrl];
    console.log(`   • fetching sitemap: ${fromUrl}`);
    try {
        const xml = await axios.get<string>(fromUrl).then(r => r.data);
        const parsed: any = await parseStringPromise(xml);
        return (
            parsed.urlset?.url
                ?.map((u: any) => u.loc?.[0])
                .filter((l: any) => typeof l === 'string' && l.includes('/p/')) ?? []
        );
    } catch (err: any) {
        console.warn(`   • could not fetch/parse sitemap: ${fromUrl}`, err.message || err);
        return [];
    }
}

/* ------------------------------------------------------------------ */
/* 3.  Garment ID extraction                                          */
/* ------------------------------------------------------------------ */
function toGarmentId(pageUrl: string): string | null {
    const parts = new URL(pageUrl).pathname.split('/').pop()!.split('-');
    const codeIndex = parts.findIndex(p => /^[A-Za-z]{2}\d+[A-Za-z0-9]*$/.test(p));
    if (codeIndex === -1) return null;
    const code = parts[codeIndex].toUpperCase();
    const rawColour = parts.slice(codeIndex + 1).join(' ');
    return `${code}|${encodeURIComponent(rawColour.toUpperCase())}`;
}

/* ------------------------------------------------------------------ */
/* 4.  Build upsert payload                                          */
/* ------------------------------------------------------------------ */
interface UpsertPayload {
    where: { url: string };
    update: object;
    create: object;
}

export async function buildUpsert(pageUrl: string, config: SiteDataConfig,): Promise<UpsertPayload | null> {
    const garmentId = toGarmentId(pageUrl);
    if (!garmentId) return null;

    const apiUrl =
        `https://dressipi.glassons.com/api/items/${garmentId}/related` +
        `?placement_id=2d6e2291-d528-439e-9821-fa37e7e50ded` +
        `&locale=au&garment_format=detailed&methods=outfits,partner_outfits&try_all_methods=true`;

    let resp: any;
    try {
        resp = (await client.get(apiUrl)).data;
    } catch (err: any) {
        console.error(`   • API fetch failed ${apiUrl}:`, err.message || err);
        return null;
    }

    const allItems: any[] = resp.garment_data || [];
    const current = allItems.find(i => i.url === pageUrl);
    if (!current) return null;

    const catName: string = current.garment_category_name;
    if (['Belts', 'Bags', 'Necklaces'].includes(catName)) return null;

    const name: string = current.name;
    const brand: string = current.brand_name;
    const price: number = parseFloat(current.price);
    const listPrice: number = parseFloat(current.old_price);
    const sale: boolean = price < listPrice;
    const category: string = normalizeCategory(current.garment_category_name);
    const sex = 'women';
    const images: string[] = (current.feed_image_urls || []).map((url: string) => url.split('?')[0]);

    const baseFields = { name, metaData: '', brand, price, standardPrice: listPrice, sale, retailer: 'Glassons', category, sex };

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
                createMany: { data: images.map(imageUrl => ({ imageUrl })) },
            },
        },
    };
}

/* ------------------------------------------------------------------ */
/* 5.  Main entry – concurrent sync                                   */
/* ------------------------------------------------------------------ */
export async function handleGlassons(
    config: SiteDataConfig,
    prisma: PrismaClient
): Promise<void> {
    const sources = config.siteMapUrl.flatMap(raw => raw.split(',').map(s => s.trim()).filter(Boolean));
    const urlSets = await Promise.all(sources.map(extractProductUrls));
    const productUrls = Array.from(new Set(urlSets.flat()));
    console.log(`→ Glassons: ${productUrls.length} products to sync`);

    const CONCURRENT = 12;
    await pMap(productUrls, async (pageUrl) => {
        try {
            const upsertData = await buildUpsert(pageUrl, config);
            if (!upsertData) return;
            (upsertData.create as any).siteDataConfigId = config.id;
            await prisma.$transaction(tx => tx.productItem.upsert(upsertData as any));
            console.log(`   • synced Glassons ${pageUrl}`);
        } catch (err: any) {
            console.error(`   • failed ${pageUrl}:`, err.message || err);
        }
    }, { concurrency: CONCURRENT });

    console.log('✓ Glassons sync complete');
}