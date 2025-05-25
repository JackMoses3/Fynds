/* eslint-disable @typescript-eslint/no-unsafe-argument */
import axios, { AxiosInstance } from 'axios';
import * as zlib from 'zlib';
import pMap from 'p-map';
import { XMLParser } from 'fast-xml-parser';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import * as cheerio from 'cheerio';
import { PrismaClient, SiteDataConfig } from '@prisma/client';
import { BROWSER_HEADERS, inferSex, normalizeCategory } from '../utils/utils';

const JSON_HEADERS = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
};


/* ------------------------------------------------------------------ */
/* 1. Axios instance with keep-alive                                 */
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
/* 2. Sitemap reader                                                  */
/* ------------------------------------------------------------------ */
const xmlParser = new XMLParser({ ignoreAttributes: true });

async function extractProductUrls(sitemapUrl: string): Promise<string[]> {
    console.log(`   • fetching sitemap ${sitemapUrl}`);
    let xml: string;

    if (sitemapUrl.endsWith('.gz')) {
        const resp = await client.get<ArrayBuffer>(sitemapUrl, { responseType: 'arraybuffer' });
        xml = zlib.gunzipSync(Buffer.from(resp.data)).toString('utf-8');
    } else {
        xml = (await client.get<string>(sitemapUrl)).data;
    }

    const parsed = xmlParser.parse(xml) as any;
    const entries = parsed.urlset?.url ?? [];
    // fast-xml-parser gives loc as string, not array
    return entries
        .map((e: any) => {
            if (typeof e.loc === 'string') return e.loc;
            if (Array.isArray(e.loc) && typeof e.loc[0] === 'string') return e.loc[0];
            return '';
        })
        .filter((u: string) => u);
}

/* ------------------------------------------------------------------ */
/* 3. One product fetch + transform                                   */
/* ------------------------------------------------------------------ */
interface UpsertPayload {
    where: { url: string };
    update: object;
    create: object;
}

async function buildUpsert(pageUrl: string): Promise<UpsertPayload[] | null> {
    // skip preview pages
    if (pageUrl.includes('-pT')) return null;

    // fetch HTML to get canonical URL
    let html: string;
    try {
        html = (await client.get<string>(pageUrl)).data;
    } catch {
        return null;
    }
    const $ = cheerio.load(html);
    const canonical = $('meta[property="og:url"]').attr('content')?.trim() ?? pageUrl;
    const jsonUrl = canonical + (canonical.includes('?') ? '&ajax=true' : '?ajax=true');

    let data: any;
    try {
        data = (await client.get(jsonUrl, { headers: JSON_HEADERS })).data;
    } catch (err: any) {
        if (axios.isAxiosError(err) && err.response?.status === 410) {
            console.warn(`   • 410 gone: ${jsonUrl}`);
            return null;
        }
        throw err;
    }

    const p = data.product;
    const sex = inferSex(p.sectionName as string, []);
    const category = normalizeCategory(p.name as string);

    const payloads: UpsertPayload[] = [];
    for (const color of (p.detail?.colors as any[]) ?? []) {
        const url = canonical;
        const rawDesc = color.description as string ?? '';
        const metaData = rawDesc
            .replace(/<!--[\s\S]*?-->/g, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const price = ((color.pricing?.price?.value as number) ?? 0) / 100;
        const sale = (color.sizes as any[] ?? []).some(
            (sz: any) => sz.price !== (color.pricing?.price?.value as number)
        );

        const images: string[] = (color.mainImgs as any[] ?? [])
            .filter(m => m.type === 'image')
            .map(m => {
                // take whichever URL field exists
                let url = (m.url as string) || m.extraInfo.deliveryUrl as string;

                // strip off query parameters (everything after '?')
                url = url.split('?')[0];

                // ensure it ends with .jpg
                if (!url.match(/\.jpe?g$/i)) {
                    url = url.replace(/\.\w+$/i, '') + '.jpg';
                }

                return url;
            })
            .filter(Boolean);

        const videos: string[] = (color.mainImgs as any[] ?? [])
            .filter((m: any) => typeof m.videoFallbackUrl === 'string')
            .map((m: any) => m.videoFallbackUrl as string);

        payloads.push({
            where: { url },
            update: {
                sex,
                name: p.name,
                metaData,
                retailer: 'Zara',
                price,
                sale,
                brand: 'Zara',
                storeId: BigInt(p.id),
                category,
                subCategory: null,
                lastModified: null,
                siteDataConfigId: undefined,
                productImages: { deleteMany: {}, create: images.map(i => ({ imageUrl: i })) },
                itemVideos: { deleteMany: {}, create: videos.map(v => ({ videoUrl: v })) },
            },
            create: {
                url,
                sex,
                name: p.name,
                metaData,
                retailer: 'Zara',
                price,
                sale,
                brand: 'Zara',
                storeId: BigInt(color.productId),
                category,
                subCategory: null,
                lastModified: null,
                siteDataConfigId: undefined,
                productImages: { create: images.map(i => ({ imageUrl: i })) },
                itemVideos: { create: videos.map(v => ({ videoUrl: v })) },
            },
        });
    }

    return payloads.length ? payloads : null;
}

/* ------------------------------------------------------------------ */
/* 4. Main entry – concurrent sync                                    */
/* ------------------------------------------------------------------ */
export async function handleZara(
    config: SiteDataConfig,
    prisma: PrismaClient,
): Promise<void> {
    const sitemaps = config.siteMapUrl
        .flatMap(s => s.split(',').map(x => x.trim()).filter(Boolean));

    const urlLists = await Promise.all(sitemaps.map(extractProductUrls));
    const productUrls = Array.from(new Set(urlLists.flat()));
    console.log(`→ Zara: ${productUrls.length} URLs to process`);

    const CONCURRENT = 12;
    await pMap(
        productUrls,
        async (url) => {
            try {
                const upserts = await buildUpsert(url);
                if (!upserts) return;
                for (const u of upserts) {
                    (u.create as any).siteDataConfigId = config.id;
                    await prisma.$transaction(tx => tx.productItem.upsert(u as any));
                    console.log(`   • synced ${u.where.url}`);
                }
            } catch (err) {
                console.error(`   • failed ${url}:`, (err as Error).message);
            }
        },
        { concurrency: CONCURRENT },
    );
    console.log('✓ Zara sync complete');
}
