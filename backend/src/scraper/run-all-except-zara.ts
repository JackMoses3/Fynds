// run-all-except-zara.ts

import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';

const prisma = new PrismaClient();

async function run() {
    const configs = await prisma.siteDataConfig.findMany();

    for (const config of configs) {
        if (config.domain === 'zara.com' || config.domain === 'ghanda.com') {
            console.log(`⏭️ Skipping ${config.domain}`);
            continue;
        }


        console.log(`🔍 Scraping ${config.domain}...`);

        await new Promise<void>((resolve, reject) => {
            const proc = exec(`ts-node src/scraper/main-scraper.ts ${config.domain}`, (err, stdout, stderr) => {
                if (err) {
                    console.error(`❌ Error scraping ${config.domain}:\n${stderr}`);
                    return reject(err);
                }
                console.log(`✅ Finished ${config.domain}:\n${stdout}`);
                resolve();
            });
        });
    }

    await prisma.$disconnect();
}

run().catch(err => {
    console.error('❌ Failed to complete scraping run:', err);
    process.exit(1);
});
