import path from 'path';

export const BLOG_ID = 'ranto28';
export const START_URL = 'https://blog.naver.com/PostList.naver';
export const DATA_DIR = path.join(__dirname, '../../data');
export const POSTS_DIR = path.join(DATA_DIR, 'posts');

export const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

