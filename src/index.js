const { scrape } = require('./scraper');

const args = process.argv.slice(2);
const updateMode = args.includes('--update');

(async () => {
    try {
        await scrape(updateMode);
    } catch (error) {
        console.error('Fatal Error:', error);
        process.exit(1);
    }
})();
