// run-multiple-scrape.ts
// Launches each platform scraper sequentially, streaming logs directly to console

import { spawn } from 'child_process';

const domains = [
    'hm.com',
    //'zara.com',
    //'glassons.com',
    //'ghanda.com',
    //'cos.com',
    //'iamgia.com',
    //'vici.com',
    //'joahbrown.com',
    //'iamdelilah.com',
    'mango.com',
    'americaneagle.com.au',
    //'urbanoutfitters.com',
    //'arthurapparel.com',
    //'withconsideration.com.au',
    //'scuffers.com',
    //'studiokatiegray.com',
    //'universalstore.com',
    //'levis.com.au',
    //'iamgia.com',
    //'kathmandu.com.au',
    //'generalpants.com',
    //'gluestore.com.au',
    //'incu.com',
    //'assemblylabel.com',
    //'ajeworld.com.au',
    //'lionessfashion.com',
    //'princesspolly.com.au',
    //'lululemon.com.au',
    //'citybeach.com',
    //'bronzesnake.com',
    //'brandymelville.com',
    //'whitefoxboutique.com.au',
    //'beginningboutique.com.au',
    //'afends.com',
    //'synds.com.au',
    //'zanerobe.com',
    //'quicksilver.com.au',
    //'modemischiefstudios.com',
    //'becandbridge.com.au',
    //'edikted.com',
    //'iamdelilah.com',
    //'motelrocks.com',
    //'meski.com.au',
    //'drmersclub.com',
    //'coldcultureworldwide.com',
    //'decarbashop.com',
    //'jadedldn.com',
    //'forever21.com',
    //'dissh.com.au',
    //'rollasjeans.com',
    //'abrandjeans.com',
    //'thrills.co',
    //'eliteelevensporting.com',
    //'oasisfashion.com',
    //'southst.com.au',
    //'withjean.com.au',
    //'observegallery.com',
    //'sheike.com.au',
    //'2xu.com',
    //'camilla.com',
    //'gormanshop.com.au',
    //'kookai.com.au'
];

async function run() {
    for (const domain of domains) {
        console.log(`▶️ Running scraper for ${domain}…`);
        await new Promise<void>((resolve) => {
            const child = spawn(
                'npx',
                ['ts-node', 'src/scraper/main-scraper.ts', domain],
                { stdio: 'inherit', shell: true }
            );

            child.on('error', (err) => {
                console.error(`❌ Error spawning scraper for ${domain}:`, err.message);
                // Resolve to continue with next domain
                resolve();
            });

            child.on('exit', (code) => {
                if (code === 0) {
                    console.log(`✅ Completed scrape for ${domain}`);
                } else {
                    console.error(`❌ Scraper for ${domain} exited with code ${code}`);
                }
                resolve();
            });
        });
    }
}

run().catch((err) => {
    console.error('❌ Fatal run error:', err);
    process.exit(1);
});
