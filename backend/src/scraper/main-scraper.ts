// src/scraper.ts

import { PrismaClient } from '../../generated/prisma';
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
      await handleShopify(config, prisma);
      break;

    case 'zara':
      await handleZara(config, prisma);
      break;

    case 'iamgia':
      await handleIAmGia(config, prisma);
      break;

    case 'skims':
      await handleSkims(config, prisma);
      break;

    case 'mango':
      await handleMango(config, prisma);
      break;

    case 'americaneagle':
      await handleAmericanEagle(config, prisma);
      break;

    case 'fashionnova':
      await handleFashionNova(config, prisma);
      break;

    case 'cos':
      await handleCos(config, prisma);
      break;

    case 'ghanda':
      await handleGhanda(config, prisma);
      break;

    case 'lululemon':
      await handleLululemon(config, prisma);
      break;

    case 'adidas':
      await handleAdidas(config, prisma);
      break;

    case 'hm':
      await handleHM(config, prisma);
      break;

    case 'glassons':
      await handleGlassons(config, prisma);
      break

    case 'urbanoutfitters':
      await handleUrban(config, prisma);
      break;

    case 'citybeach':
      await handleCityBeach(config, prisma);
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
