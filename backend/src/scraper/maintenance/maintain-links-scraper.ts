/* src/maintain-scraper.ts */
/* eslint-disable no-console */
import pMap from 'p-map';
import { PrismaClient, SiteDataConfig } from '@prisma/client';

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
    return new Promise(res => setTimeout(res, ms));
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

/* ------------------------------------------------------------------ */
/* 3️⃣  Typings                                                         */
/* ------------------------------------------------------------------ */
type UpsertPayload = Parameters<
    PrismaClient['productItem']['upsert']
>[0];

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
            buildUpsert: mod.buildUpsert,
        };
    }

    /* Otherwise, if it has extractProductUrls we can build a wrapper */
    if (typeof mod.extractProductUrls === 'function') {
        const listProductUrls = async (cfg: SiteDataConfig): Promise<string[]> => {
            const sources = cfg.siteMapUrl
                .flatMap((raw) =>
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

        return { listProductUrls, buildUpsert: mod.buildUpsert };
    }

    /* Fallback: no discovery available (adds/updates only) */
    return { buildUpsert: mod.buildUpsert };
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
            `→ No handler registered for platform “${cfg.ecommercePlatform}”. Skipping.`,
        );
        return;
    }

    const CONCURRENCY = cfg.ecommercePlatform === 'shopify' ? 4 : 12;

    console.log(
        `\n→ Starting maintenance for ${cfg.retailerName} (${cfg.ecommercePlatform})`,
    );

    /* 1. URLs currently in DB */
    const existing = await prisma.productItem.findMany({
        where: { siteDataConfigId: cfg.id },
        select: { url: true },
    });
    const existingUrls = new Set(existing.map((r) => r.url));

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
    }

    /* 3. Decide ADD / DELETE */
    const toAdd = liveUrls ? [...liveUrls].filter((u) => !existingUrls.has(u)) : [];
    const toDelete = liveUrls ? [...existingUrls].filter((u) => !liveUrls.has(u)) : [];

    /* 4. ADD / UPDATE ---------------------------------------------------- */
    const addCount = await pMap(
        liveUrls ? toAdd : [...existingUrls], // if no diff, revisit everything
        async (pageUrl) => {
            try {
                const upserts = await handler.buildUpsert(pageUrl, cfg);
                if (!upserts) return 0;

                // Handle multiple upserts (like Zara does per color)
                for (const upsert of Array.isArray(upserts) ? upserts : [upserts]) {
                    await safeUpsert(() =>
                        prisma.$transaction(tx => tx.productItem.upsert(upsert as any)),
                    );
                }
                console.log(`      + synced ${pageUrl}`);
                return 1;

            } catch (err: any) {
                console.error(`      ! failed ${pageUrl}: ${err.message}`);
                return 0;
            }
        },
        { concurrency: CONCURRENCY },
    ).then((vals) => vals.reduce((a, b) => a + b, 0));

    /* 5. DELETE ---------------------------------------------------------- */
    let delCount = 0;
    if (toDelete.length) {
        delCount = await pMap(
            toDelete,
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
    }

    console.log(
        `✓ Finished ${cfg.retailerName}: added/updated ${addCount}` +
        (liveUrls ? `, deleted ${delCount}` : ' (no deletes – diff unavailable)'),
    );
}

/* ------------------------------------------------------------------ */
/* 7️⃣  CLI entry-point                                                */
/* ------------------------------------------------------------------ */
if (require.main === module) {
    (async () => {
        try {
            const configs = await prisma.siteDataConfig.findMany();
            const TARGET_DATE = new Date('2025-05-30');
            for (const cfg of configs) {
                const last = cfg.lastCrawled;
                if (last && last.toISOString().startsWith(TARGET_DATE.toISOString().slice(0, 10))) {
                    console.log(`→ Skipping ${cfg.retailerName} (already crawled on ${last.toISOString().split('T')[0]})`);
                    continue;
                }
                else if (cfg.id === 3 || cfg.id === 4 || cfg.id === 5 || cfg.id === 6 || cfg.id === 11) {
                    continue;
                }
                await maintainConfig(cfg);

                await prisma.siteDataConfig.update({
                    where: { id: cfg.id },
                    data: { lastCrawled: new Date() },
                });

                console.log(`✓ Updated lastCrawled for ${cfg.retailerName} (${cfg.ecommercePlatform})`);

            }
        } catch (err) {
            console.error(err);
        } finally {
            await prisma.$disconnect();
        }
    })();
}

export { maintainConfig };
