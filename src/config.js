const path = require('path');

module.exports = {
    BLOG_ID: 'ranto28',
    START_URL: 'https://blog.naver.com/PostList.naver',
    DATA_DIR: path.join(__dirname, '../data'),
    OUTPUT_FILE: path.join(__dirname, '../data/all_posts.md'),
    HEADERS: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
};
