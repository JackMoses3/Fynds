/* src/maintain-scraper.ts */
/* eslint-disable no-console */
import pMap from 'p-map';
import axios from 'axios';
import {
  PrismaClient,
  Prisma,
  SiteDataConfig,
} from '../../../generated/prisma';

/* ------------------------------------------------------------------ */
/* 1️⃣  Import every handler module                                    */
/* ------------------------------------------------------------------ */
/*   adjust paths if your repo layout differs                          */
import * as shopify from '../handlers/shopify';
import * as adidas from '../handlers/adidas';
import * as americanEagle from '../handlers/americaneagle';
import * as cityBeach from '../handlers/citybeach';
import * as cos from '../handlers/cos';
import * as fashionNova from '../handlers/fashionnova';
import * as ghanda from '../handlers/ghanda';
import * as glassons from '../handlers/glassons';
import * as hm from '../handlers/hm';
import * as iamgia from '../handlers/iamgia';
import * as lululemon from '../handlers/lululemon';
import * as mango from '../handlers/mango';
import * as skims from '../handlers/skims';
import * as urbanOutfitters from '../handlers/urbanoutfitters';
import * as zara from '../handlers/zara';

/* ------------------------------------------------------------------ */
/* 2️⃣  Shared helpers                                                 */
/* ------------------------------------------------------------------ */
function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

async function safeUpsert<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      if (
        err?.message?.includes('Unable to start a transaction') &&
        i < retries - 1
      ) {
        const wait = 40 * 4 ** i;
        console.warn(
          `   • transaction timeout, retrying in ${wait} ms (attempt ${i + 1})`,
        );
        await delay(wait);
        continue;
      }
      throw err;
    }
  }
  throw new Error('Upsert failed after retries');
}

/**
 * Delete products from Qdrant by product IDs
 * Returns array of successfully deleted product IDs
 */
async function deleteFromQdrant(productIds: number[]): Promise<number[]> {
  if (productIds.length === 0) return [];

  const successfullyDeleted: number[] = [];

  try {
    console.log(`   • Deleting ${productIds.length} products from Qdrant...`);
    console.log(`   • Product IDs to delete: [${productIds.join(', ')}]`);

    // Use the correct ML service URL from environment variables
    const ML_SERVICE_URL = process.env.ML_URL || 'http://localhost:8000';

    const collections = [
      'TEXT_EMBEDDINGS',
      'IMAGE_FRONT_EMBEDDINGS',
      'IMAGE_BACK_EMBEDDINGS',
    ];

    // Track which products were successfully deleted from ALL collections
    const productDeletionStatus = new Map<
      number,
      { success: number; total: number }
    >();

    // Initialize tracking for each product
    productIds.forEach((id) => {
      productDeletionStatus.set(id, { success: 0, total: collections.length });
    });

    for (const collection of collections) {
      console.log(`   • Processing collection: ${collection}`);

      for (const productId of productIds) {
        try {
          const response = await axios.post(
            `${ML_SERVICE_URL}/api/v1/vector/delete`,
            {
              collection: collection,
              product_id: productId,
            },
          );

          if (response.status === 200) {
            const status = productDeletionStatus.get(productId)!;
            status.success++;
            console.log(
              `     ✓ Deleted product ${productId} from ${collection}`,
            );
          } else {
            console.warn(
              `     ! Product ${productId} deletion from ${collection} returned status ${response.status}`,
            );
          }
        } catch (error: any) {
          console.warn(
            `     ! Failed to delete product ${productId} from ${collection}: ${error.message}`,
          );
        }
      }
    }

    // Only mark products as successfully deleted if they were deleted from ALL collections
    productDeletionStatus.forEach((status, productId) => {
      if (status.success === status.total) {
        successfullyDeleted.push(productId);
        console.log(
          `     ✅ Product ${productId} successfully deleted from all collections`,
        );
      } else {
        console.warn(
          `     ⚠️  Product ${productId} only deleted from ${status.success}/${status.total} collections - WILL NOT DELETE FROM DB`,
        );
      }
    });

    console.log(
      `   ✓ Successfully deleted ${successfullyDeleted.length}/${productIds.length} products from Qdrant`,
    );
  } catch (error: any) {
    console.error(
      `   ! Failed to delete products from Qdrant: ${error.message}`,
    );
  }

  return successfullyDeleted;
}

/**
 * Call the batch-embed-retailer endpoint to generate embeddings for a retailer
 */
async function callBatchEmbedRetailer(retailerName: string): Promise<void> {
  try {
    console.log(`   • Starting batch embedding for ${retailerName}...`);

    const response = await axios.post(
      'http://localhost:3000/api/embedding-qdrant/batch-embed-retailer',
      {
        retailer: retailerName,
        batchSize: 8, // Adjust based on your system capacity
        concurrency: 4, // Lower concurrency to avoid overwhelming the embedding service
      },
      {
        timeout: 1800000, // 30 minutes timeout
      },
    );

    console.log(`   ✓ Batch embedding completed for ${retailerName}`);
    console.log(`   • Result: ${JSON.stringify(response.data)}`);
  } catch (error: any) {
    console.error(
      `   ! Failed to run batch embedding for ${retailerName}: ${error.message}`,
    );
    // Don't throw - this is not critical for the scraping process
  }
}

/* ------------------------------------------------------------------ */
/* 3️⃣  Typings                                                         */
/* ------------------------------------------------------------------ */
type UpsertPayload = Parameters<PrismaClient['productItem']['upsert']>[0];

export interface PlatformHandler {
  /** Return live product URLs (optional ⇒ we skip deletions) */
  listProductUrls?: (cfg: SiteDataConfig) => Promise<string[]>;

  /** Build the Prisma upsert payload for ONE product URL */
  buildUpsert: (
    pageUrl: string,
    cfg: SiteDataConfig,
  ) => Promise<UpsertPayload | null>;
}

/* ------------------------------------------------------------------ */
/* 4️⃣  Adapter that auto-creates listProductUrls                      */
/* ------------------------------------------------------------------ */
const autoWrap = (mod: any): PlatformHandler => {
  /* If the module already supplies listProductUrls, just use it */
  if (typeof mod.listProductUrls === 'function') {
    return {
      listProductUrls: mod.listProductUrls,
      buildUpsert: mod.buildUpsert as PlatformHandler['buildUpsert'],
    };
  }

  /* Otherwise, if it has extractProductUrls we can build a wrapper */
  if (typeof mod.extractProductUrls === 'function') {
    const listProductUrls = async (cfg: SiteDataConfig): Promise<string[]> => {
      const sources = cfg.siteMapUrl.flatMap((raw) =>
        raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      );
      const sets = await Promise.all(
        sources.map((s) => mod.extractProductUrls(s)),
      );
      return [...new Set(sets.flat())];
    };

    return {
      listProductUrls,
      buildUpsert: mod.buildUpsert as PlatformHandler['buildUpsert'],
    };
  }

  /* Fallback: no discovery available (adds/updates only) */
  return { buildUpsert: mod.buildUpsert as PlatformHandler['buildUpsert'] };
};

/* ------------------------------------------------------------------ */
/* 5️⃣  Registry of handlers                                           */
/* ------------------------------------------------------------------ */
const HANDLERS: Record<string, PlatformHandler> = {
  /* Special case for Shopify (needs sitemap helper) */
  shopify: {
    listProductUrls: async (cfg) => {
      const urls: string[] = [];
      for (const sm of cfg.siteMapUrl.map((s) => s.trim()).filter(Boolean)) {
        const list = await shopify.extractProductUrls(sm);
        urls.push(...list);
      }
      return urls;
    },
    buildUpsert: shopify.buildUpsert as PlatformHandler['buildUpsert'],
  },

  /* Every other platform goes through autoWrap() */

  adidas: autoWrap(adidas),
  americaneagle: autoWrap(americanEagle),
  citybeach: autoWrap(cityBeach),
  cos: autoWrap(cos),
  fashionnova: autoWrap(fashionNova),
  ghanda: autoWrap(ghanda),
  glassons: autoWrap(glassons),
  hm: autoWrap(hm),
  iamgia: autoWrap(iamgia),
  lululemon: autoWrap(lululemon),
  mango: autoWrap(mango),
  skims: autoWrap(skims),
  urbanoutfitters: autoWrap(urbanOutfitters),
  zara: autoWrap(zara),
};

/* ------------------------------------------------------------------ */
/* 6️⃣  Generic maintenance routine                                    */
/* ------------------------------------------------------------------ */
const prisma = new PrismaClient();

async function maintainConfig(cfg: SiteDataConfig): Promise<void> {
  const handler = HANDLERS[cfg.ecommercePlatform as keyof typeof HANDLERS];

  if (!handler) {
    console.warn(
      `→ No handler registered for platform "${cfg.ecommercePlatform}". Skipping.`,
    );
    return;
  }

  const CONCURRENCY = cfg.ecommercePlatform === 'shopify' ? 4 : 12;

  console.log(
    `\n→ Starting maintenance for ${cfg.retailerName} (${cfg.ecommercePlatform})`,
  );

  /* 1. URLs currently in DB with their IDs */
  const existing = await prisma.productItem.findMany({
    where: { siteDataConfigId: cfg.id },
    select: { id: true, url: true },
  });
  const existingUrls = new Set(existing.map((r) => r.url));
  const urlToIdMap = new Map(existing.map((r) => [r.url, r.id]));

  /* 2. Live URLs (if discoverable) */
  let liveUrls: Set<string> | null = null;
  if (handler.listProductUrls) {
    const list = await handler.listProductUrls(cfg);
    liveUrls = new Set(list);
    console.log(
      `   • Live URLs fetched: ${liveUrls.size}. DB has: ${existingUrls.size}`,
    );
  } else {
    console.warn('   • URL discovery unavailable → deletions skipped');
    return; // Can't proceed without URL discovery for full maintenance
  }

  /* 3. Decide ADD / DELETE (NO UPDATES) */
  const toAdd = [...liveUrls].filter((u) => !existingUrls.has(u));
  const toDelete = [...existingUrls].filter((u) => !liveUrls.has(u));

  console.log(`   • To add: ${toAdd.length}, to delete: ${toDelete.length}`);

  /* 4. ADD NEW PRODUCTS ------------------------------------------------ */
  console.log(`\n   → Adding ${toAdd.length} new products...`);
  const addCount = await pMap(
    toAdd,
    async (pageUrl) => {
      try {
        const upserts = await handler.buildUpsert(pageUrl, cfg);
        if (!upserts) return 0;

        // Handle multiple upserts (like Zara does per color)
        for (const upsert of Array.isArray(upserts) ? upserts : [upserts]) {
          await safeUpsert(() =>
            prisma.$transaction((tx: Prisma.TransactionClient) =>
              tx.productItem.upsert(upsert as any),
            ),
          );
        }
        console.log(`      + added ${pageUrl}`);
        return 1;
      } catch (err: any) {
        console.error(`      ! failed ${pageUrl}: ${err.message}`);
        return 0;
      }
    },
    { concurrency: CONCURRENCY },
  ).then((vals) => vals.reduce((a, b) => a + b, 0));

  /* 5. DELETE OLD PRODUCTS --------------------------------------------- */
  let delCount = 0;
  if (toDelete.length) {
    console.log(`\n   → Deleting ${toDelete.length} old products...`);

    // Get product IDs for deletion from Qdrant
    const productIdsToDelete = toDelete
      .map((url) => urlToIdMap.get(url))
      .filter((id): id is number => id !== undefined);

    // Delete from Qdrant first - only proceed with DB deletion if successful
    const successfullyDeletedFromQdrant =
      await deleteFromQdrant(productIdsToDelete);

    if (successfullyDeletedFromQdrant.length === 0) {
      console.warn(
        `   ⚠️  No products successfully deleted from Qdrant - skipping DB deletion`,
      );
    } else {
      // Only delete from DB the products that were successfully deleted from Qdrant
      const urlsToDeleteFromDb = toDelete.filter((url) => {
        const productId = urlToIdMap.get(url);
        return productId && successfullyDeletedFromQdrant.includes(productId);
      });

      console.log(
        `   • Deleting ${urlsToDeleteFromDb.length} products from DB (successfully removed from Qdrant)`,
      );

      delCount = await pMap(
        urlsToDeleteFromDb,
        async (pageUrl) => {
          try {
            await prisma.productItem.delete({ where: { url: pageUrl } });
            console.log(`      – removed ${pageUrl}`);
            return 1;
          } catch (err: any) {
            console.error(`      ! delete failed ${pageUrl}: ${err.message}`);
            return 0;
          }
        },
        { concurrency: CONCURRENCY },
      ).then((vals) => vals.reduce((a, b) => a + b, 0));

      // Report on any products that couldn't be deleted from DB
      const failedDbDeletions = successfullyDeletedFromQdrant.length - delCount;
      if (failedDbDeletions > 0) {
        console.warn(
          `   ⚠️  ${failedDbDeletions} products were deleted from Qdrant but failed to delete from DB`,
        );
      }
    }
  }

  console.log(
    `\n✓ Database operations completed for ${cfg.retailerName}:` +
      ` added ${addCount}, deleted ${delCount}`,
  );

  /* 6. GENERATE EMBEDDINGS FOR RETAILER -------------------------------- */
  console.log(`\n   → Generating embeddings for ${cfg.retailerName}...`);
  await callBatchEmbedRetailer(cfg.retailerName);

  console.log(`\n🎉 Maintenance completed for ${cfg.retailerName}!`);
}

/* ------------------------------------------------------------------ */
/* 7️⃣  CLI entry-point (ONLY ID 193)                                 */
/* ------------------------------------------------------------------ */
if (require.main === module) {
  (async () => {
    try {
      // Target all configs except IDs: 4, 16, 6, 8, 86
      const excludeIds = [3, 4, 16, 6, 8, 86];

      // Fetch all configs except the excluded ones
      let configs = await prisma.siteDataConfig.findMany({
        where: {
          id: { notIn: excludeIds },
        },
      });

      if (configs.length === 0) {
        console.log('→ No configs found (all excluded)');
        return;
      }

      // Sort configs by ID in ascending order
      configs = configs.sort((a, b) => a.id - b.id);

      // Find config with ID 10 (if present)
      const cfg10Index = configs.findIndex((cfg) => cfg.id === 10);
      if (cfg10Index !== -1) {
        const cfg = configs[cfg10Index];
        console.log(
          `→ Running maintenance for ${cfg.retailerName} (ID: ${cfg.id})`,
        );
        await maintainConfig(cfg);
        await prisma.siteDataConfig.update({
          where: { id: cfg.id },
          data: { lastCrawled: new Date() },
        });
        console.log(
          `✓ Updated lastCrawled for ${cfg.retailerName} (${cfg.ecommercePlatform})`,
        );
        // Remove ID 10 from the list so it's not processed again
        configs.splice(cfg10Index, 1);
      }

      // Process the rest in sequential order (ascending by ID)
      for (const cfg of configs) {
        console.log(
          `→ Running maintenance for ${cfg.retailerName} (ID: ${cfg.id})`,
        );

        await maintainConfig(cfg);

        await prisma.siteDataConfig.update({
          where: { id: cfg.id },
          data: { lastCrawled: new Date() },
        });

        console.log(
          `✓ Updated lastCrawled for ${cfg.retailerName} (${cfg.ecommercePlatform})`,
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      await prisma.$disconnect();
    }
  })();
}

export { maintainConfig };
