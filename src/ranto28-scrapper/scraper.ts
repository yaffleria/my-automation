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
  console.log('Starting Scraper (Individual Markdown Files)...');

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

  while (keepGoing) {
    const postIds = await getPostIds(page);

    if (postIds.length === 0) {
      keepGoing = false;
      break;
    }

    for (const id of postIds) {
      progressBar.update(scrapedCount, { currentId: id });

      if (existingIds.has(id)) {
        if (updateMode) {
          // Stop immediately on update mode
          keepGoing = false;
          break;
        } else {
          continue; // Skip existing in full scan
        }
      }

      // Scrape New
      const postData = await scrapePost(id);
      if (postData) {
        savePostAsFile(postData);
        existingIds.add(id);
        scrapedCount++;
      }
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


