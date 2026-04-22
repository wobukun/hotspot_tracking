import axios, { AxiosRequestConfig } from 'axios';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

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

class ChinaSourcesService {
  private config: AxiosRequestConfig = {
    timeout: 15000, // 国内源超时15秒
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Referer': 'https://www.bilibili.com/'
    }
  };

  // WBI签名所需的重排映射表
  private readonly mixinKeyEncTab = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
    33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
    61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
    36, 20, 34, 44, 52
  ];

  private wbiCache: { imgKey: string; subKey: string; lastUpdate: number } | null = null;
  private readonly wbiCacheTime = 3600000; // 1小时缓存

  /**
   * 搜索网页
   */
  async search(engine: string, keyword: string, limit: number = 10): Promise<SearchResult[]> {
    try {
      console.log(`🔍 [${engine}] 搜索关键词: ${keyword}`);
      
      switch (engine) {
        case 'sogou':
          return await this.searchSogou(keyword, limit);
        case 'bilibili':
          return await this.searchBilibiliAPI(keyword, limit);
        case 'weibo':
          return await this.getWeiboHotSearch(limit);
        default:
          console.log(`⚠️ 不支持的搜索引擎: ${engine}`);
          return [];
      }
    } catch (error) {
      console.error(`❌ [${engine}] 搜索失败:`, error);
      return [];
    }
  }

  /**
   * 获取WBI签名所需的imgKey和subKey
   */
  private async getWbiKeys(): Promise<{ imgKey: string; subKey: string }> {
    const now = Date.now();
    
    // 检查缓存
    if (this.wbiCache && (now - this.wbiCache.lastUpdate < this.wbiCacheTime)) {
      return { imgKey: this.wbiCache.imgKey, subKey: this.wbiCache.subKey };
    }

    try {
      const response = await axios.get('https://api.bilibili.com/x/web-interface/nav', this.config);
      const { data } = response.data;
      
      if (data?.wbi_img) {
        const imgUrl = data.wbi_img.img_url;
        const subUrl = data.wbi_img.sub_url;
        
        const imgKey = imgUrl.slice(imgUrl.lastIndexOf('/') + 1, imgUrl.lastIndexOf('.'));
        const subKey = subUrl.slice(subUrl.lastIndexOf('/') + 1, subUrl.lastIndexOf('.'));
        
        // 缓存结果
        this.wbiCache = { imgKey, subKey, lastUpdate: now };
        
        console.log(`✅ 获取WBI密钥成功`);
        return { imgKey, subKey };
      }
    } catch (error) {
      console.error('❌ 获取WBI密钥失败:', error);
    }

    // 如果失败，返回默认密钥（可能已过期）
    return { 
      imgKey: '7cd084941338484aae1ad9425b84077c', 
      subKey: '4932caff0ff746eab6f01bf08b70ac45' 
    };
  }

  /**
   * 生成mixinKey
   */
  private getMixinKey(orig: string): string {
    return this.mixinKeyEncTab
      .map(n => orig[n])
      .join('')
      .slice(0, 32);
  }

  /**
   * WBI签名算法
   */
  private async encWbi(params: Record<string, string | number>): Promise<string> {
    const { imgKey, subKey } = await this.getWbiKeys();
    const mixinKey = this.getMixinKey(imgKey + subKey);
    const currTime = Math.round(Date.now() / 1000);
    
    // 添加时间戳
    params['wts'] = currTime;
    
    // 过滤特殊字符
    const chrFilter = /[!'()*]/g;
    
    // 按键名升序排序
    const sortedKeys = Object.keys(params).sort();
    
    // 构建查询字符串
    const query = sortedKeys
      .map(key => {
        const value = params[key].toString().replace(chrFilter, '');
        return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
      })
      .join('&');
    
    // 计算MD5签名
    const wbiSign = crypto.createHash('md5').update(query + mixinKey).digest('hex');
    
    return `${query}&w_rid=${wbiSign}`;
  }

  /**
   * 使用B站API搜索视频（WBI签名）
   */
  private async searchBilibiliAPI(keyword: string, limit: number): Promise<SearchResult[]> {
    try {
      console.log(`🔍 [B站API] 搜索关键词: ${keyword}`);
      
      const results: SearchResult[] = [];
      const now = Date.now();
      const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000; // 90天前，放宽时间限制
      
      // 搜索3页内容，获取更多数据
      for (let page = 1; page <= 3 && results.length < limit; page++) {
        try {
          // 构建搜索参数
          const searchParams = {
            keyword,
            search_type: 'video',
            order: 'totalrank',
            page,
            page_size: limit * 2 // 多请求一些
          };
          
          // 生成WBI签名
          const signedQuery = await this.encWbi(searchParams);
          const url = `https://api.bilibili.com/x/web-interface/wbi/search/type?${signedQuery}`;
          
          const response = await axios.get(url, this.config);
          const { code, data, message } = response.data;
          
          if (code !== 0) {
            console.error(`❌ [B站API] 第${page}页搜索失败: ${message}`);
            break;
          }
          
          if (data?.result) {
            for (const item of data.result) {
              if (results.length >= limit) break;
              
              // 筛选条件：
              // 1. 播放量至少300，放宽更多
              // 2. 发布时间在90天内
              const viewCount = item.play || 0;
              const pubdate = item.pubdate;
              const publishTime = pubdate ? new Date(pubdate * 1000).toISOString() : undefined;
              
              if (viewCount < 300) continue;
              
              if (pubdate) {
                const videoDate = new Date(pubdate * 1000).getTime();
                if (videoDate < ninetyDaysAgo) continue;
              }
              
              results.push({
                title: this.cleanHtmlTags(item.title),
                url: `https://www.bilibili.com/video/${item.bvid}`,
                content: item.description || 'B站视频',
                source: 'bilibili',
                publishTime,
                author: item.author,
                viewCount,
                commentCount: item.review,
                likeCount: undefined
              });
            }
          }
          
          // 如果这页没有结果，就不继续下一页了
          if (!data?.result || data.result.length === 0) {
            break;
          }
          
          // 稍微延时一下，避免请求过快
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (pageError) {
          console.error(`❌ [B站API] 第${page}页异常:`, pageError);
          break;
        }
      }
      
      if (results.length === 0) {
        console.log(`⏭️ [B站API] 没找到内容，尝试网页爬取`);
        return await this.searchBilibiliWeb(keyword, limit);
      }
      
      console.log(`✅ [B站API] 找到 ${results.length} 条符合条件的热点视频`);
      return results;
    } catch (error) {
      console.error(`❌ [B站API] 搜索异常:`, error);
      return await this.searchBilibiliWeb(keyword, limit);
    }
  }

  /**
   * 回退方法：B站网页爬取
   */
  private async searchBilibiliWeb(keyword: string, limit: number): Promise<SearchResult[]> {
    try {
      console.log(`🔍 [B站网页] 搜索关键词: ${keyword}`);
      const url = `https://search.bilibili.com/all?keyword=${encodeURIComponent(keyword)}&amp;order=totalrank`;
      const response = await axios.get(url, this.config);
      const $ = cheerio.load(response.data);
      const results: SearchResult[] = [];
      const seenUrls = new Set<string>();

      $('.bili-video-card').each((_index: number, element: any) => {
        if (results.length >= limit) return;
        
        const $el = $(element);
        
        const title = $el.find('.bili-video-card__info--tit').text().trim() ||
                      $el.find('a').first().attr('title') || '';
        let url = $el.find('a').first().attr('href') || '';
        
        if (!title || !url || url.includes('#')) return;
        
        if (!url.startsWith('http')) {
          url = url.startsWith('//') ? 'https:' + url : 'https://www.bilibili.com' + url;
        }
        
        if (!url.includes('/video/')) return;
        
        if (seenUrls.has(url)) return;
        seenUrls.add(url);
        
        const author = $el.find('.bili-video-card__info--author').text().trim() || undefined;
        const viewText = $el.find('.bili-video-card__stats--item').first().text().trim();
        const viewCount = this.parseNumber(viewText);
        const danmakuText = $el.find('.bili-video-card__stats--item').eq(1).text().trim();
        const commentCount = this.parseNumber(danmakuText);
        
        // 同样筛选播放量至少1000
        if (!viewCount || viewCount < 1000) return;
        
        results.push({
          title,
          url,
          content: 'B站视频',
          source: 'bilibili',
          publishTime: undefined, // 网页爬取无法获取准确时间
          author,
          viewCount,
          commentCount,
          likeCount: undefined
        });
      });

      console.log(`✅ [B站网页] 找到 ${results.length} 条符合条件的热点视频`);
      return results;
    } catch (error) {
      console.error(`❌ [B站网页] 搜索失败:`, error);
      return [];
    }
  }

  /**
   * 清理HTML标签
   */
  private cleanHtmlTags(text: string): string {
    return text.replace(/<[^>]*>/g, '');
  }

  /**
   * 搜狗搜索
   */
  private async searchSogou(keyword: string, limit: number): Promise<SearchResult[]> {
    try {
      const url = `https://www.sogou.com/web?query=${encodeURIComponent(keyword)}&sort=time`;
      const response = await axios.get(url, this.config);
      const $ = cheerio.load(response.data);
      const results: SearchResult[] = [];

      $('.vrwrap').each((_index: number, element: any) => {
        if (results.length >= limit) return;
        
        const $el = $(element);
        
        const isAd = $el.find('.rb, .ad-mark').length > 0 || 
                     $el.attr('class')?.includes('ad') ||
                     $el.text().includes('广告');
                     
        if (isAd) {
          console.log(`⏭️ 跳过搜狗广告`);
          return;
        }
        
        const title = $el.find('h3 a, .title a').first().text().trim();
        let url = $el.find('h3 a, .title a').first().attr('href') || '';
        const content = $el.find('.str_info, .abstract, .desc').first().text().trim();
        
        if (!title || !url) return;
        
        if (!url.startsWith('http')) {
          url = url.startsWith('//') ? 'https:' + url : 'https://www.sogou.com' + url;
        }
        
        if (url.includes('sogou.com') && !url.includes('link')) {
          return;
        }
        
        let publishTime: string | undefined;
        const timeText = $el.find('.time, .date, .pub-date').text().trim() ||
                         $el.text().match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}小时前|\d{1,2}分钟前|昨天|前天)/)?.[0];
                         
        if (timeText) {
          publishTime = this.parseTimeText(timeText);
        }
        
        const negativeKeywords = ['百科', '知道', '问答', '是什么', '定义', '原理', '入门', '教程'];
        const hasNegativeKeyword = negativeKeywords.some(keyword => 
          title.includes(keyword) || content.includes(keyword)
        );
        
        if (hasNegativeKeyword) {
          console.log(`📚 跳过非热点内容: ${title}`);
          return;
        }
        
        results.push({
          title,
          url,
          content: content || '搜狗搜索结果',
          source: 'sogou',
          publishTime: publishTime,
          viewCount: undefined,
          commentCount: undefined,
          likeCount: undefined
        });
      });

      console.log(`✅ [搜狗搜索] 找到 ${results.length} 条结果`);
      return results;
    } catch (error) {
      console.error(`❌ [搜狗搜索] 搜索失败:`, error);
      return [];
    }
  }

  /**
   * 解析数字字符串
   */
  private parseNumber(text: string): number | undefined {
    if (!text) return undefined;
    
    const match = text.match(/([\d.]+)\s*[万亿千]?/);
    if (!match) return undefined;
    
    let num = parseFloat(match[1]);
    if (isNaN(num)) return undefined;
    
    if (text.includes('万')) num *= 10000;
    if (text.includes('亿')) num *= 100000000;
    if (text.includes('千')) num *= 1000;
    
    return Math.round(num);
  }

  /**
   * 解析时间文本为ISO格式
   */
  private parseTimeText(timeText: string): string | undefined {
    try {
      const now = new Date();
      
      if (timeText.includes('小时前')) {
        const hours = parseInt(timeText);
        if (!isNaN(hours)) {
          const date = new Date(now.getTime() - hours * 60 * 60 * 1000);
          return date.toISOString();
        }
      }
      
      if (timeText.includes('分钟前')) {
        const minutes = parseInt(timeText);
        if (!isNaN(minutes)) {
          const date = new Date(now.getTime() - minutes * 60 * 1000);
          return date.toISOString();
        }
      }
      
      if (timeText.includes('昨天')) {
        const date = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        return date.toISOString();
      }
      
      if (timeText.includes('前天')) {
        const date = new Date(now.getTime() - 48 * 60 * 60 * 1000);
        return date.toISOString();
      }
      
      const dateMatch = timeText.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
      if (dateMatch) {
        const [, year, month, day] = dateMatch;
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }
      
      const shortDateMatch = timeText.match(/(\d{1,2})[-/](\d{1,2})/);
      if (shortDateMatch) {
        const [, month, day] = shortDateMatch;
        const date = new Date(now.getFullYear(), parseInt(month) - 1, parseInt(day));
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }
      
      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * 微博热搜
   */
  private async getWeiboHotSearch(limit: number): Promise<SearchResult[]> {
    try {
      const url = 'https://s.weibo.com/top/summary';
      const response = await axios.get(url, this.config);
      const $ = cheerio.load(response.data);
      const results: SearchResult[] = [];

      $('td.td-02').each((_index: number, element: any) => {
        if (results.length >= limit) return;
        
        const $el = $(element);
        const title = $el.find('a').text().trim();
        let url = $el.find('a').attr('href') || '';
        
        if (title && url) {
          if (!url.startsWith('http')) {
            url = url.startsWith('//') ? 'https:' : url;
            url = url.startsWith('https') ? url : 'https://s.weibo.com' + url;
          }
          
          const hotText = $el.find('.hot').text().trim();
          const hotNumber = this.parseNumber(hotText);
          
          results.push({
            title,
            url,
            content: '微博热搜',
            source: 'weibo',
            publishTime: new Date().toISOString(),
            viewCount: hotNumber,
            commentCount: undefined,
            likeCount: undefined
          });
        }
      });

      console.log(`✅ [微博] 找到 ${results.length} 条热搜`);
      return results;
    } catch (error) {
      console.error(`❌ [微博] 获取热搜失败:`, error);
      return [];
    }
  }


}

export default new ChinaSourcesService();
