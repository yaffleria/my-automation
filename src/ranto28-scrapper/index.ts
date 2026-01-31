import { scrape } from './scraper';

export async function run(args: string[]) {
  const updateMode = args.includes('--update');
  try {
    await scrape(updateMode);
  } catch (error) {
    console.error('Fatal Error:', error);
    process.exit(1);
  }
}
