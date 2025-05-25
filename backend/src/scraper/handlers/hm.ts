// src/handlers/hm.ts

import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { PrismaClient, SiteDataConfig } from '@prisma/client';
import { BROWSER_HEADERS, inferSex, normalizeCategory } from '../utils/utils';

const JSON_HEADERS = {
    'Content-Type': 'application/json',
    ...BROWSER_HEADERS
};

export async function handleHM(
    config: SiteDataConfig,
    prisma: PrismaClient
) {
    for (const rawSitemapUrl of config.siteMapUrl) {
        const sitemapUrl = rawSitemapUrl.trim();
        console.log(`Fetching H&M sitemap: ${sitemapUrl}`);

        // 1. Download the sitemap XML
        let xml: string;
        try {
            xml = await axios
                .get<string>(sitemapUrl, { headers: BROWSER_HEADERS })
                .then((r) => r.data);
        } catch (err) {
            console.error(`  • failed to fetch sitemap ${sitemapUrl}`, err);
            continue;
        }

        // 2. Parse and extract <loc> entries
        let parsed: any;
        try {
            parsed = await parseStringPromise(xml);
        } catch (err) {
            console.error(`  • failed to parse XML for ${sitemapUrl}`, err);
            continue;
        }
        const urls: string[] =
            parsed.urlset?.url
                ?.map((u: any) => u.loc?.[0])
                .filter((loc: string) => typeof loc === 'string') ?? [];

        // 3. For each <loc> that looks like a product page, sync it
        for (const pageUrl of urls) {
            // only product pages
            const m = pageUrl.match(/\/productpage\.(\d+)\.html$/);
            if (!m) {
                // e.g. category or index pages
                continue;
            }
            const articleId = m[1];
            console.log(`Processing H&M product: ${pageUrl}`);

            // 4. Build the API URL
            const localeMatch = pageUrl.match(/\/([a-z]{2}_[a-z]{2})\//i);
            const locale = localeMatch ? localeMatch[1] : 'en_au';

            const apiUrl =
                `https://api.hm.com/search-services/v1/` +
                `${locale}/search/byids?ids=${articleId}&touchPoint=DESKTOP&pageSource=pdp-shopthelook`;

            let payload: any;
            try {
                payload = await axios
                    .get(apiUrl, { headers: JSON_HEADERS })
                    .then((r) => r.data);
            } catch (err) {
                console.error(`  • failed H&M API ${apiUrl}`, err);
                continue;
            }

            const items: any[] = payload.articles?.productList ?? [];
            for (const art of items) {
                const rawCat = art.mainCatCode;  // e.g. "women_dresses_maxi"

                // skip any Accessories or Shoes
                if (rawCat.includes('accessories') || rawCat.includes('shoes')) {
                    console.log(`  • skipping Accessories/Shoes category ${rawCat}`);
                    continue;
                }

                // 5. Extract our fields
                const url = `https://www2.hm.com${art.url}`;
                const name = art.productName;
                const brand = art.brandName;
                const price = art.prices?.[0]?.price ?? 0;
                const sale =
                    art.prices?.[0]?.minPrice != null &&
                    art.prices[0].maxPrice != null &&
                    art.prices[0].minPrice !== art.prices[0].maxPrice;
                const images: string[] = (art.images ?? []).map((i: any) => i.url);
                const videos: string[] = [];
                const category = normalizeCategory(art.mainCatCode);
                const sex = inferSex(art.mainCatCode, []);

                // 6. Upsert into Prisma
                await prisma.productItem.upsert({
                    where: { url },
                    update: {
                        name,
                        brand,
                        price,
                        standardPrice: art.prices[0].maxPrice,
                        sale,
                        retailer: 'H&M',
                        category,
                        sex,
                        productImages: {
                            deleteMany: {},
                            create: images.map((img) => ({ imageUrl: img })),
                        },
                        itemVideos: {
                            deleteMany: {},
                            create: videos.map((v) => ({ videoUrl: v })),
                        },
                    },
                    create: {
                        url,
                        name,
                        brand,
                        price,
                        standardPrice: art.prices[0].maxPrice,
                        sale,
                        retailer: 'H&M',
                        category,
                        sex,
                        metaData: '',
                        subCategory: null,
                        lastModified: null,
                        siteDataConfigId: config.id,
                        productImages: {
                            create: images.map((img) => ({ imageUrl: img })),
                        },
                        itemVideos: {
                            create: videos.map((v) => ({ videoUrl: v })),
                        },
                    },
                });

                console.log(`  • synced H&M item ${url}`);
            }
        }
    }
}
