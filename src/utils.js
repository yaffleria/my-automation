const fs = require('fs');
const path = require('path');
const { OUTPUT_FILE, DATA_DIR } = require('./config');

const ID_LIST_FILE = path.join(DATA_DIR, 'scraped_ids.json');

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

// Manage ID list (Lightweight check for existing posts)
function getExistingIdSet() {
    ensureDir(DATA_DIR);
    if (fs.existsSync(ID_LIST_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(ID_LIST_FILE, 'utf8'));
            return new Set(data);
        } catch (e) {
            console.error('Error reading ID list, starting fresh:', e.message);
            return new Set();
        }
    }
    return new Set();
}

function saveIdSet(idSet) {
    ensureDir(DATA_DIR);
    fs.writeFileSync(ID_LIST_FILE, JSON.stringify([...idSet], null, 2), 'utf8');
}

function cleanContent(content) {
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
function formatPostToMarkdown(post) {
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
function appendToMasterFile(post) {
    ensureDir(path.dirname(OUTPUT_FILE));
    const mdContent = formatPostToMarkdown(post);
    fs.appendFileSync(OUTPUT_FILE, mdContent, 'utf8');
}

// If we want to support "Update" where we might insert new posts at the TOP of an existing file...
// That's tricky with simple append. 
// For "Update" mode (fetching strictly new posts), we likely want them at the very top.
// But file prepending is expensive (read all, write new, write old).
// Given the user wants "One Single File", maybe it's acceptable to just rebuild if order matters strictly?
// Or we can read the existing file content once at start, and rewrite it at the end?
// Let's stick to a simple strategy:
// 1. `start` (full scrape): Overwrite file, valid New->Old order.
// 2. `update` (partial): We find X new posts. We need to put them at the TOP.
//    So we define a `saveNewPosts` helper that takes a LIST of new posts and handles the file IO.

function saveNewPostsToMaster(newPosts, mode = 'append') {
    // newPosts is array of post objects
    if (newPosts.length === 0) return;

    ensureDir(path.dirname(OUTPUT_FILE));
    
    // Sort newPosts by ID descending just in case (Newest first)
    // (They should already be in order if scraped from page 1, 2...)
    // But let's be safe.
    // Actually IDs are not strictly chronological across years but usually yes.
    
    const newContent = newPosts.map(formatPostToMarkdown).join('');

    if (mode === 'overwrite') {
        fs.writeFileSync(OUTPUT_FILE, newContent, 'utf8');
    } else if (mode === 'prepend') {
        // Update mode: New posts go to top
        let existingContent = '';
        if (fs.existsSync(OUTPUT_FILE)) {
            existingContent = fs.readFileSync(OUTPUT_FILE, 'utf8');
        }
        fs.writeFileSync(OUTPUT_FILE, newContent + existingContent, 'utf8');
    } else {
        // Append mode (default for full scrape stream?) 
        // Actually for full scrape "start", we perform an overwrite initially (empty file) then append chunk by chunk?
        // Or just keep appending.
        fs.appendFileSync(OUTPUT_FILE, newContent, 'utf8');
    }
}

function splitMasterFile() {
    if (!fs.existsSync(OUTPUT_FILE)) {
        console.log('No master file found to split.');
        return;
    }

    const content = fs.readFileSync(OUTPUT_FILE, 'utf8');
    // Split by the delimiter we use: "\n---\n\n"
    // Note: The last post might end with the delimiter too, so we filter empty strings
    const posts = content.split('\n---\n\n').filter(p => p.trim().length > 0);

    const CHUNK_SIZE = 300;
    const TOTAL_CHUNKS = Math.ceil(posts.length / CHUNK_SIZE);

    console.log(`Splitting ${posts.length} posts into ${TOTAL_CHUNKS} parts (max ${CHUNK_SIZE} per file)...`);

    for (let i = 0; i < TOTAL_CHUNKS; i++) {
        const chunk = posts.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        // Re-join with the delimiter
        const chunkContent = chunk.join('\n---\n\n') + '\n---\n\n';
        
        // Output file naming: all_posts_part1.md, all_posts_part2.md
        const partNum = i + 1;
        const partFileName = `all_posts_part${partNum}.md`;
        const partFilePath = path.join(DATA_DIR, partFileName);

        fs.writeFileSync(partFilePath, chunkContent, 'utf8');
        console.log(`Created ${partFileName} (${chunk.length} posts)`);
    }
}

module.exports = {
    ensureDir,
    getExistingIdSet,
    saveIdSet,
    saveNewPostsToMaster,
    splitMasterFile,
    ID_LIST_FILE
};
