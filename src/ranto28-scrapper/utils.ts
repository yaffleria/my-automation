import fs from 'fs';
import path from 'path';
import { DATA_DIR, POSTS_DIR } from './config';

export const ID_LIST_FILE = path.join(DATA_DIR, 'scraped_ids.json');

export function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Manage ID list (Lightweight check for existing posts)
export function getExistingIdSet(): Set<string> {
  ensureDir(DATA_DIR);
  if (fs.existsSync(ID_LIST_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(ID_LIST_FILE, 'utf8'));
      return new Set(data);
    } catch (e) {
      console.error('Error reading ID list, starting fresh:', (e as Error).message);
      return new Set();
    }
  }
  return new Set();
}

export function saveIdSet(idSet: Set<string>) {
  ensureDir(DATA_DIR);
  fs.writeFileSync(ID_LIST_FILE, JSON.stringify([...idSet], null, 2), 'utf8');
}

function cleanContent(content: string): string {
  if (!content) return '';

  return content
    .replace(/©.*출처.*/g, '')
    .replace(/©.*Unsplash.*/g, '')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/(\D)(\d+\.)/g, '$1\n$2')
    .replace(/^\s+(\d+\.)/gm, '$1')
    .replace(/\n\s+\n/g, '\n\n')
    .trim();
}

// Generate the Post Markdown String
// Define Post interface
export interface Post {
  id: string;
  title: string;
  url: string;
  date: string;
  content: string;
  scrapedAt?: string;
}

export function formatPostToMarkdown(post: Post): string {
  let md = '';
  md += `# ${post.title}\n`;
  md += `Date: ${post.date}\n`;
  md += `URL: ${post.url}\n\n`;
  // Clean content right before formatting
  md += `${cleanContent(post.content)}\n`;
  md += `\n---\n\n`;
  return md;
}

// We will read the existing MD file, and PREPEND new posts (since we scrape newest first)
// OR append if we scrape oldest first.
// Naver blog list usually gives newest first.
// If we want the file to be Newest -> Oldest (Top to Bottom), we should Append IF we are scraping New -> Old?
// wait, if we iterate pages 1, 2, 3... we get Newest posts first.
// So if we just Append to the file, the file will be ordered Newest -> Oldest.
// Correct. Page 1 (Newest) -> written first. Page 2 (Older) -> written next.
// So simple Append is correct for Newest-to-Oldest order.
export function savePostAsFile(post: Post) {
  ensureDir(POSTS_DIR);
  const safeTitle = post.title.replace(/[^a-z0-9가-힣\s]/gi, '').trim().replace(/\s+/g, '_');
  // Using ID in filename ensures uniqueness and ease of retrieval.
  // Adding title helps readability.
  const filename = `${post.id}_${safeTitle}.md`; 
  const filePath = path.join(POSTS_DIR, filename);
  
  const mdContent = formatPostToMarkdown(post);
  fs.writeFileSync(filePath, mdContent, 'utf8');
}


