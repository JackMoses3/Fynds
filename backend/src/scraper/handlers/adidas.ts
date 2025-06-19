// src/handlers/adidas.ts
/* eslint-disable */
import axios from 'axios';
import { URL } from 'url';
import { parseStringPromise, processors } from 'xml2js';
import { PrismaClient } from '@prisma/client';
import type { SiteDataConfig } from 'generated/prisma';
import { BROWSER_HEADERS, inferSex, normalizeCategory } from '../utils/utils';

const CUSTOM_HEADERS = {
  ...BROWSER_HEADERS,
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://www.adidas.com.au/',
  Connection: 'keep-alive',
  DNT: '1',
  'Upgrade-Insecure-Requests': '1',
};

async function extractProductUrls(fromUrl: string): Promise<string[]> {
  if (!fromUrl.endsWith('.xml')) {
    console.log(`   • not a sitemap, using single URL: ${fromUrl}`);
    return [fromUrl];
  }

  console.log(`   • fetching sitemap: ${fromUrl}`);
  let xml: string;
  try {
    const resp = await axios.get<string>(fromUrl, {
      headers: CUSTOM_HEADERS,
      timeout: 10000,
    });
    xml = resp.data;
  } catch (err: any) {
    console.error(`   • HTTP error fetching sitemap:`, err.message || err);
    return [];
  }

  const trimmed = xml.trim();
  let parsed: any;
  try {
    parsed = await parseStringPromise(trimmed, {
      explicitArray: true,
      tagNameProcessors: [processors.stripPrefix],
      xmlns: false,
    });
  } catch (err: any) {
    console.error(`   • XML parse error:`, err.message || err);
    return [];
  }

  const entries =
    (parsed.urlset?.url as Array<{ loc: string[] }> | undefined) ?? [];
  const urls = entries
    .map((entry) => entry.loc[0])
    .filter(
      (loc): loc is string => typeof loc === 'string' && loc.endsWith('.html'),
    );

  console.log(`   • extracted ${urls.length} URLs`);
  return urls;
}

function toProductId(pageUrl: string): string | null {
  const seg = new URL(pageUrl).pathname.split('/').pop() || '';
  return seg.endsWith('.html') ? seg.slice(0, -5) : null;
}

export async function handleAdidas(
  config: SiteDataConfig,
  prisma: PrismaClient,
): Promise<void> {
  for (const raw of config.siteMapUrl) {
    const src = raw.trim();
    console.log(`→ Adidas source: ${src}`);

    const productUrls = await extractProductUrls(src);
    if (!productUrls.length) {
      console.log(`   • no product URLs found in ${src}`);
      continue;
    }

    for (const pageUrl of productUrls) {
      console.log(`→ Adidas product page: ${pageUrl}`);

      const productId = toProductId(pageUrl);
      if (!productId) {
        console.warn(`   • can't extract productId from "${pageUrl}"`);
        continue;
      }

      const apiUrl = `https://www.adidas.com.au/api/products/${productId}`;
      let data: any;
      try {
        data = (await axios.get(apiUrl, { headers: CUSTOM_HEADERS })).data;
      } catch (err: any) {
        console.error(`   • API fetch failed ${apiUrl}:`, err.message || err);
        continue;
      }

      const rawCat = data.attribute_list?.category || '';
      if (rawCat.toLowerCase() !== 'clothing') {
        console.log(`   • skipping non-clothing category: ${rawCat}`);
        continue;
      }

      const name: string = data.name || '';
      const metaData: string = data.product_description.text || '';
      const brand: string = data.attribute_list?.brand || 'Adidas';
      const currentPrice: number = data.pricing_information?.currentPrice ?? 0;
      const standardPrice: number =
        data.pricing_information?.standard_price ?? currentPrice;
      const sale: boolean = currentPrice < standardPrice;
      const category: string = normalizeCategory(name);
      const sex: string = inferSex(data.attribute_list?.gender || '', []);

      const images: string[] = (
        (data.view_list as Array<{ image_url: string }>) || []
      )
        .map((img) => img.image_url.replace(/\/w_600,f_auto,q_auto\//, '/'))
        .filter(Boolean);

      const videoUrl: string | null =
        data.product_description?.description_assets?.video_url || null;

      await prisma.productItem.upsert({
        where: { url: pageUrl },
        update: {
          name,
          metaData,
          brand,
          price: currentPrice,
          standardPrice,
          sale,
          retailer: 'Adidas',
          category,
          sex,
        },
        create: {
          url: pageUrl,
          name,
          metaData,
          brand,
          price: currentPrice,
          standardPrice,
          sale,
          retailer: 'Adidas',
          category,
          sex,
          lastModified: null,
          siteDataConfigId: config.id,
          productImages: {
            create: images.map((imageUrl) => ({ imageUrl })),
          },
          ...(videoUrl
            ? {
                itemVideos: {
                  create: [{ videoUrl }],
                },
              }
            : {}),
        },
      });

      console.log(
        `   • synced Adidas ${pageUrl} @ $${currentPrice.toFixed(2)}` +
          (sale ? ' (sale!)' : ''),
      );
    }
  }
}
