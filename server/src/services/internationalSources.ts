import axios, { AxiosRequestConfig } from 'axios';
import * as cheerio from 'cheerio';

interface SearchResult {
  title: string;
  url: string;
  content: string;
  source: string;
  publishTime?: string;
  author?: string;
  viewCount?: number;
  commentCount?: number;
  likeCount?: number;
}

class InternationalSourcesService {
  private config: AxiosRequestConfig = {
    timeout: 8000, // 国际源超时时间缩短到8秒，快速跳过
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    }
  };

  /**
   * 搜索网页
   */
  async search(engine: string, keyword: string, limit: number = 10): Promise<SearchResult[]> {
    console.log(`🔍 [${engine}] 搜索关键词: ${keyword}`);
    
    switch (engine) {
      case 'bing':
        return await this.searchBing(keyword, limit);
      case 'google':
        return await this.searchGoogle(keyword, limit);
      case 'duckduckgo':
        return await this.searchDuckDuckGo(keyword, limit);
      case 'hackernews':
        return await this.searchHackerNews(keyword, limit);
      default:
        console.log(`⚠️ 不支持的搜索引擎: ${engine}`);
        return [];
    }
  }

  /**
   * Bing 搜索
   */
  private async searchBing(keyword: string, limit: number): Promise<SearchResult[]> {
    try {
      const url = `https://www.bing.com/search?q=${encodeURIComponent(keyword)}&setlang=en-US`;
      const response = await axios.get(url, this.config);
      const $ = cheerio.load(response.data);
      const results: SearchResult[] = [];

      $('.b_algo, li.b_algo').each((_index: number, element: any) => {
        if (results.length >= limit) return;
        
        const $el = $(element);
        const title = $el.find('h2 a').text().trim();
        let url = $el.find('h2 a').attr('href') || '';
        const content = $el.find('.b_caption p').text().trim();
        
        if (title && url && url.startsWith('http') && !url.includes('bing.com')) {
          results.push({
            title,
            url,
            content: content || 'Bing搜索',
            source: 'bing',
            publishTime: undefined,
            viewCount: undefined,
            commentCount: undefined,
            likeCount: undefined
          });
        }
      });

      if (results.length === 0) {
        console.log(`⏭️ [Bing] 没有找到结果，跳过该信息源`);
        throw new Error('Bing无搜索结果');
      }

      console.log(`✅ [Bing] 找到 ${results.length} 条结果`);
      return results;
    } catch (error) {
      console.error(`❌ [Bing] 搜索失败，跳过该信息源:`, error);
      throw error;
    }
  }

  /**
   * Google 搜索
   */
  private async searchGoogle(keyword: string, limit: number): Promise<SearchResult[]> {
    try {
      const url = `https://www.google.com/search?q=${encodeURIComponent(keyword)}&hl=en`;
      const response = await axios.get(url, this.config);
      const $ = cheerio.load(response.data);
      const results: SearchResult[] = [];

      $('div.g').each((_index: number, element: any) => {
        if (results.length >= limit) return;
        
        const $el = $(element);
        const title = $el.find('h3').text().trim();
        let url = $el.find('a').attr('href') || '';
        const content = $el.find('div.VwiC3b').text().trim();
        
        // 处理 Google 的搜索结果 URL
        if (url.startsWith('/url?q=')) {
          url = decodeURIComponent(url.replace('/url?q=', '').split('&')[0]);
        }
        
        if (title && url && url.startsWith('http') && !url.includes('google.com')) {
          results.push({
            title,
            url,
            content: content || 'Google搜索',
            source: 'google',
            publishTime: undefined,
            viewCount: undefined,
            commentCount: undefined,
            likeCount: undefined
          });
        }
      });

      if (results.length === 0) {
        console.log(`⏭️ [Google] 没有找到结果，跳过该信息源`);
        throw new Error('Google无搜索结果');
      }

      console.log(`✅ [Google] 找到 ${results.length} 条结果`);
      return results;
    } catch (error) {
      console.error(`❌ [Google] 搜索失败，跳过该信息源:`, error);
      throw error;
    }
  }

  /**
   * DuckDuckGo 搜索
   */
  private async searchDuckDuckGo(keyword: string, limit: number): Promise<SearchResult[]> {
    try {
      // DuckDuckGo 的公开 API
      const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(keyword)}`;
      const response = await axios.get(url, this.config);
      const $ = cheerio.load(response.data);
      const results: SearchResult[] = [];

      $('.result').each((_index: number, element: any) => {
        if (results.length >= limit) return;
        
        const $el = $(element);
        const title = $el.find('.result__title a').text().trim();
        const url = $el.find('.result__title a').attr('href') || '';
        const content = $el.find('.result__snippet').text().trim();
        
        if (title && url && url.startsWith('http')) {
          results.push({
            title,
            url,
            content: content || 'DuckDuckGo搜索',
            source: 'duckduckgo',
            publishTime: undefined,
            viewCount: undefined,
            commentCount: undefined,
            likeCount: undefined
          });
        }
      });

      if (results.length === 0) {
        console.log(`⏭️ [DuckDuckGo] 没有找到结果，跳过该信息源`);
        throw new Error('DuckDuckGo无搜索结果');
      }

      console.log(`✅ [DuckDuckGo] 找到 ${results.length} 条结果`);
      return results;
    } catch (error) {
      console.error(`❌ [DuckDuckGo] 搜索失败，跳过该信息源:`, error);
      throw error;
    }
  }

  /**
   * Hacker News 搜索 (使用 Algolia API)
   */
  private async searchHackerNews(keyword: string, limit: number): Promise<SearchResult[]> {
    try {
      // Hacker News 的 Algolia API
      const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(keyword)}&tags=story&hitsPerPage=${limit}`;
      const response = await axios.get(url, this.config);
      const results: SearchResult[] = [];

      if (response.data.hits) {
        for (const hit of response.data.hits) {
          if (results.length >= limit) break;
          
          const title = hit.title || '';
          const url = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
          const author = hit.author || '';
          const points = hit.points || 0;
          const comments = hit.num_comments || 0;
          
          // 从时间戳转换为 ISO 字符串
          let publishTime;
          if (hit.created_at_i) {
            publishTime = new Date(hit.created_at_i * 1000).toISOString();
          }
          
          if (title) {
            results.push({
              title,
              url,
              content: `Hacker News 热门话题，热度: ${points} 点`,
              source: 'hackernews',
              publishTime,
              author,
              viewCount: points, // 在 Hacker News 中用 points 代表热度
              commentCount: comments,
              likeCount: points
            });
          }
        }
      }

      if (results.length === 0) {
        console.log(`⏭️ [HackerNews] 没有找到结果，跳过该信息源`);
        throw new Error('HackerNews无搜索结果');
      }

      console.log(`✅ [HackerNews] 找到 ${results.length} 条结果`);
      return results;
    } catch (error) {
      console.error(`❌ [HackerNews] 搜索失败，跳过该信息源:`, error);
      throw error;
    }
  }
}

export default new InternationalSourcesService();
