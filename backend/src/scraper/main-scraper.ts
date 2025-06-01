// src/scraper.ts

import { PrismaClient, SiteDataConfig } from '@prisma/client';
import { handleShopify } from './handlers/shopify';
import { handleZara } from './handlers/zara';
import { handleCityBeach } from './handlers/citybeach';
import { handleHM } from './handlers/hm';
import { handleUrban } from './handlers/urbanoutfitters';
import { handleGlassons } from './handlers/glassons';
import { handleAdidas } from './handlers/adidas';
import { handleLululemon } from './handlers/lululemon';
import { handleGhanda } from './handlers/ghanda';
import { handleCos } from './handlers/cos';
import { handleFashionNova } from './handlers/fashionnova';
import { handleAmericanEagle } from './handlers/americaneagle';
import { handleIAmGia } from './handlers/iamgia';
import { handleSkims } from './handlers/skims';
import { handleMango } from './handlers/mango';


async function main() {
  const prisma = new PrismaClient();

  // 1. load your siteDataConfig by domain
  const domain = process.argv[2] || 'vici.com';
  const config = await prisma.siteDataConfig.findUnique({
    where: { domain },
  });

  if (!config) {
    console.error(`No SiteDataConfig found for domain "${domain}"`);
    process.exit(1);
  }

  // 2. dispatch to the right handler
  switch (config.ecommercePlatform) {
    case 'shopify':
      await handleShopify(config as SiteDataConfig, prisma);
      break;

    case 'zara':
      await handleZara(config as SiteDataConfig, prisma);
      break;


    case 'iamgia':
      await handleIAmGia(config as SiteDataConfig, prisma);
      break;

    case 'skims':
      await handleSkims(config as SiteDataConfig, prisma);
      break;

    case 'mango':
      await handleMango(config as SiteDataConfig, prisma);
      break;

    case 'americaneagle':
      await handleAmericanEagle(config as SiteDataConfig, prisma);
      break;

    case 'fashionnova':
      await handleFashionNova(config as SiteDataConfig, prisma);
      break;

    case 'cos':
      await handleCos(config as SiteDataConfig, prisma);
      break;

    case 'ghanda':
      await handleGhanda(config as SiteDataConfig, prisma);
      break;

    case 'lululemon':
      await handleLululemon(config as SiteDataConfig, prisma);
      break;

    case 'adidas':
      await handleAdidas(config as SiteDataConfig, prisma);
      break;

    case 'hm':
      await handleHM(config as SiteDataConfig, prisma);
      break;

    case 'glassons':
      await handleGlassons(config as SiteDataConfig, prisma);
      break

    case 'urbanoutfitters':
      await handleUrban(config as SiteDataConfig, prisma);
      break;

    case 'citybeach':
      await handleCityBeach(config as SiteDataConfig, prisma);
      break;

    default:
      console.warn(`Unsupported platform "${config.ecommercePlatform}"`);
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
