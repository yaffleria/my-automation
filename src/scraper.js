const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const cliProgress = require('cli-progress');
const { BLOG_ID, START_URL, HEADERS, DATA_DIR, OUTPUT_FILE } = require('./config');
const { getExistingIdSet, saveIdSet, saveNewPostsToMaster, splitMasterFile, ID_LIST_FILE } = require('./utils');

async function getPostIds(page) {
    try {
        const url = `${START_URL}?blogId=${BLOG_ID}&currentPage=${page}`;
        const response = await axios.get(url, { headers: HEADERS });
        
        const ids = [];
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

async function scrapePost(postId) {
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
            scrapedAt: new Date().toISOString()
        };

    } catch (error) {
        return null;
    }
}

async function scrape(updateMode = false) {
    console.log('Starting Scraper (Single File Markdown + Progress Bar)...');

    // 1. Setup ID check
    const existingIds = getExistingIdSet();
    const originalCount = existingIds.size;
    console.log(`Knowledge Base: ${originalCount} posts already indexed.`);

    // 2. Setup Progress Bar
    // We don't know total posts exactly without traversing all pages (inefficient), 
    // but typically we can just show "Scraped X posts"
    const progressBar = new cliProgress.SingleBar({
        format: 'Scraping | {bar} | {value} posts | Current: {currentId}',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
    }, cliProgress.Presets.shades_classic);

    progressBar.start(2000, 0, { currentId: 'Starting...' }); // Estimate of 2000? Just a visual max, can update total later

    // If NOT update mode (Full Scrape), we should probably clear the file?
    // User asked for "Start completely clean" via command 'rm -rf data' usually.
    // But if they run 'npm start' without rm -rf, we typically skip existing.
    // If we skip existing but rely on a single file, we hope the file matches the ID list.
    
    // For safety, let's keep the ID list logic:
    // If ID exists in 'scraped_ids.json', we assume it is in the MD file.
    
    // Buffer for new posts (to write in chunks or at end)
    // Actually, for "update" (prepend), we need to collect ALL new posts then prepend.
    // For "start" (append), we can write as we go.
    
    let accumulatedNewPosts = []; 
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
                accumulatedNewPosts.push(postData);
                existingIds.add(id);
                scrapedCount++;
                
                // If Full Scrape (Start), we can append immediately to save memory?
                if (!updateMode) {
                   saveNewPostsToMaster([postData], 'append');
                   // Clear buffer to save memory
                   accumulatedNewPosts = []; 
                }
            }
            // Small delay for politeness
            await new Promise(r => setTimeout(r, 50)); 
        }
        page++;
    }

    progressBar.stop();
    console.log('\n');

    // Finish writing
    if (updateMode && accumulatedNewPosts.length > 0) {
        console.log(`Pre-pending ${accumulatedNewPosts.length} new posts to master file...`);
        saveNewPostsToMaster(accumulatedNewPosts, 'prepend');
    }
    
    // Update the ID list file
    saveIdSet(existingIds);
    console.log(`Done. Total Knowledge Base: ${existingIds.size} posts.`);
    console.log(`File: ${OUTPUT_FILE}`);

    // Post-process: Split into chunks
    console.log('\nPost-processing: Splitting master file into smaller chunks...');
    splitMasterFile();
}

module.exports = { scrape };
