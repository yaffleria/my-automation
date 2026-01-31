import axios from 'axios';
import * as cheerio from 'cheerio';
import * as cliProgress from 'cli-progress';
import {
  BLOG_ID,
  START_URL,
  HEADERS,
  POSTS_DIR,
} from './config';
import {
  getExistingIdSet,
  saveIdSet,
  savePostAsFile,
  Post,
} from './utils';

function parseNaverDate(dateStr: string): Date {
  const cleanStr = dateStr.replace(/\.$/, '');
  const parts = cleanStr.split('.');

  if (parts.length < 3) return new Date();

  const year = parseInt(parts[0].trim());
  const month = parseInt(parts[1].trim()) - 1;
  const day = parseInt(parts[2].trim());

  return new Date(year, month, day);
}

async function getPostIds(page: number): Promise<string[]> {
  try {
    const url = `${START_URL}?blogId=${BLOG_ID}&currentPage=${page}`;
    const response = await axios.get(url, { headers: HEADERS });

    const ids: string[] = [];
    const regex = /\blogNo\s*[:=]\s*['"](\d+)['"]/g;
    let match;

    while ((match = regex.exec(response.data)) !== null) {
      if (!ids.includes(match[1])) {
        ids.push(match[1]);
      }
    }
    return ids;
  } catch (error) {
    return [];
  }
}

async function scrapePost(postId: string): Promise<Post | null> {
  try {
    const url = `https://blog.naver.com/PostView.naver?blogId=${BLOG_ID}&logNo=${postId}`;
    const response = await axios.get(url, { headers: HEADERS });
    const $ = cheerio.load(response.data);

    let title = $('.se-title-text').text().trim();
    if (!title) title = $('.pcol1').text().trim();

    let date = $('.se_publishDate').text().trim();
    if (!date) date = $('.date').text().trim();

    let contentEl = $('.se-main-container');
    if (contentEl.length === 0) contentEl = $('#postViewArea');

    const content = contentEl.text().trim();

    if (!content) return null;

    return {
      id: postId,
      title: title || `Post ${postId}`,
      url,
      date,
      content,
      scrapedAt: new Date().toISOString(),
    };
  } catch (error) {
    return null;
  }
}

export async function scrape(updateMode = false) {
  console.log('Starting Scraper (Recent 1 Week)...');

  // 1. Setup ID check
  const existingIds = getExistingIdSet();
  const originalCount = existingIds.size;
  console.log(`Knowledge Base: ${originalCount} posts already indexed.`);

  // 2. Setup Progress Bar
  const progressBar = new cliProgress.SingleBar(
    {
      format: 'Scraping | {bar} | {value} posts | Current: {currentId}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    },
    cliProgress.Presets.shades_classic
  );

  progressBar.start(2000, 0, { currentId: 'Starting...' });

  let page = 1;
  let keepGoing = true;
  let scrapedCount = 0;

  // Date Logic: 7 days ago, midnight
  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(Date.now() - ONE_WEEK_MS);
  cutoffDate.setHours(0, 0, 0, 0);

  console.log(`Fetching posts since: ${cutoffDate.toLocaleDateString()}`);

  while (keepGoing) {
    const postIds = await getPostIds(page);

    if (postIds.length === 0) {
      keepGoing = false;
      break;
    }

    for (const id of postIds) {
      progressBar.update(scrapedCount, { currentId: id });

      // Always fetch to check date, unless we trust existingIds is enough?
      // For "Recent Week" we rely on date.
      // If we used updateMode before, we stopped at existing.
      // Here we stop at date. 
      // If an ID exists, we just skip saving, but we can't skip date check easily
      // unless we assume existing IDs are sorted or something.
      // Let's fetch to be safe and robust.

      const postData = await scrapePost(id);
      
      if (!postData) continue;

      const postDate = parseNaverDate(postData.date);

      if (postDate < cutoffDate) {
        // Stop the entire process if we hit old posts
        // (Assuming reverse chronological order)
        keepGoing = false;
        break;
      }

      // If we have it already, skip saving
      if (existingIds.has(id)) {
        continue;
      }

      savePostAsFile(postData);
      existingIds.add(id);
      scrapedCount++;

      // Small delay for politeness
      await new Promise((r) => setTimeout(r, 50));
    }
    page++;
  }

  progressBar.stop();
  console.log('\n');

  // Update the ID list file
  saveIdSet(existingIds);
  console.log(`Done. Total Knowledge Base: ${existingIds.size} posts.`);
  console.log(`Files saved to: ${POSTS_DIR}`);
}


