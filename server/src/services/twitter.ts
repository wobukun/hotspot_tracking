import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

class TwitterService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.TWITTER_API_KEY || '';
    this.baseUrl = process.env.TWITTER_API_BASE_URL || 'https://twitterapi.io/api';
  }

  /**
   * 搜索 Twitter 内容
   * @param keyword 搜索关键词
   * @param limit 结果数量限制
   * @returns 搜索结果
   */
  async search(keyword: string, limit: number = 10) {
    try {
      const response = await axios.get(`${this.baseUrl}/search`, {
        params: {
          query: keyword,
          limit
        },
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      return response.data;
    } catch (error) {
      console.error('Twitter API 搜索失败:', error);
      return [];
    }
  }

  /**
   * 获取用户信息
   * @param userId 用户 ID
   * @returns 用户信息
   */
  async getUser(userId: string) {
    try {
      const response = await axios.get(`${this.baseUrl}/user`, {
        params: {
          id: userId
        },
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      return response.data;
    } catch (error) {
      console.error('Twitter API 获取用户信息失败:', error);
      return null;
    }
  }
}

export default new TwitterService();