import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

class OpenRouterService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  }

  /**
   * 构建分析提示词
   * @param keyword 原始关键词
   * @param metadata 元数据
   * @returns 完整的提示词
   */
  private buildAnalysisPrompt(keyword: string, metadata?: any): string {
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;
    const metadataHint = metadata ? `
元数据：
- 作者: ${metadata.author || '未知'}
- 浏览量: ${metadata.viewCount || '未知'}
- 评论数: ${metadata.commentCount || '未知'}
- 点赞数: ${metadata.likeCount || '未知'}
- 来源: ${metadata.source || '未知'}
` : '';

    return `你是一个极其严格的热点内容审核专家。你的核心任务是：

1. 首先，在内容中搜索关键词【${keyword}】。如果关键词【${keyword}】没有在内容的标题或正文中明确出现，直接判定 relevanceScore ≤ 40 分。
2. 其次，只有内容直接、明确讨论【${keyword}】本身，而不是相关领域、同类主题、周边话题时，才能获得 60 分以上。
3. 最后，判断是否为近期热点内容。

${metadataHint}

分析要点（严格执行，不允许放松）：

【相关性判定规则】- 这是最重要的规则：
- ✅ 内容标题或正文明确提到【${keyword}】，并且内容就是围绕【${keyword}】展开讨论的 → relevanceScore 70-100 分
- ⚠️ 内容提到【${keyword}】，但只是顺便提及，不是主题 → relevanceScore 40-60 分
- ❌ 内容完全没有提到【${keyword}】，只是同一领域或相关话题 → relevanceScore ≤ 30 分
- ❌ 名词解释、百科介绍、基础知识类内容 → relevanceScore ≤ 30 分
- ❌ 营销广告、软文推广 → relevanceScore ≤ 30 分

【时效性判定规则】：
- ✅ 内容提到${currentYear}、${lastYear}、最近、近期、最新、本月、本周、今日 → 时效性加分
- ✅ 产品更新、新版本发布、新功能讨论、新闻事件 → 时效性加分
- ❌ 旧闻、历史回顾、没有时效性的基础知识 → 时效性严重扣分

【内容性质判定】：
- ✅ 新闻报道、最新动态、社区讨论、产品更新 → 合格
- ❌ 教程、入门指南、基础知识 → 不合格

【评分标准】：
- relevanceScore: 只有明确围绕【${keyword}】展开的内容才能给 60 分以上
- importanceLevel: 
  - urgent: 重大新闻、重大更新
  - high: 重要更新、热门讨论
  - medium: 一般新闻
  - low: 边角料

请以 JSON 格式输出：
{
  "isReal": true/false,
  "relevanceScore": 0-100,
  "keywordMentioned": true/false,
  "importanceLevel": "low/medium/high/urgent",
  "heatScore": 0-100,
  "credibilityScore": 0-100,
  "summary": "内容摘要...",
  "analysisReason": "此内容与关键词的关联是...",
  "relatedToKeyword": "此内容与【${keyword}】的关联：..."
}

只输出 JSON，不要有其他内容。`;
  }

  /**
   * 分析热点内容
   * @param content 要分析的内容（包含标题和内容）
   * @param keyword 关键词
   * @param metadata 元数据（作者、浏览量、评论数等）
   * @returns 分析结果
   */
  async analyzeContent(
    content: string, 
    keyword: string,
    metadata?: {
      author?: string;
      viewCount?: number;
      commentCount?: number;
      likeCount?: number;
      source?: string;
    }
  ) {
    try {
      // 直接构建分析提示词，不扩展关键词
      const systemPrompt = this.buildAnalysisPrompt(keyword, metadata);
      
      // 调用AI分析
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: 'deepseek/deepseek-v3.1-terminus',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: `关键词: "${keyword}"\n\n内容:\n${content}`
            }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      const result = response.data.choices[0].message.content;
      console.log('AI分析结果:', result);
      
      // 解析分析结果
      return this.parseAnalysisResult(result);
    } catch (error) {
      console.error('OpenRouter API 分析失败:', error);
      // 返回默认值
      return {
        credibilityScore: 50,
        relevanceScore: 50,
        importanceLevel: 'medium' as const,
        heatScore: 50,
        summary: '分析失败，无法生成摘要',
        analysisReason: '分析失败，无法生成分析理由'
      };
    }
  }

  /**
   * 扩展查询关键词
   * @param keyword 原始关键词
   * @returns 扩展后的关键词列表
   */
  async expandQuery(keyword: string) {
    const currentYear = new Date().getFullYear();
    
    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: 'deepseek/deepseek-v3.1-terminus',
          messages: [
            {
              role: 'system',
              content: `你是一个热点搜索查询扩展专家。给定一个监控关键词，生成用于搜索最新热点内容的相关检索词。

规则：
1. 包含原始关键词的各种写法（大小写、空格、连字符变体）
2. 包含时效性修饰词组合，如："关键词 ${currentYear}"、"关键词 最新"、"关键词 更新"、"关键词 发布"、"关键词 新特性"、"关键词 讨论"
3. 包含常见别称、缩写、中英文对照
4. 不要加入泛化词（比如关键词是"Claude Sonnet 4.6"，不要加"AI模型"这种泛化词）
5. 总数控制在 8-12 个
6. 优先搜索近期（${currentYear}）的内容

输出 JSON 数组，只输出 JSON，不要有其他内容。
示例输入："ChatGPT"
示例输出：["ChatGPT", "ChatGPT ${currentYear}", "ChatGPT 最新", "ChatGPT 更新", "ChatGPT 新特性", "ChatGPT 发布", "ChatGPT 讨论"]`
            },
            {
              role: 'user',
              content: keyword
            }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      const result = response.data.choices[0].message.content;
      
      // 解析JSON结果
      let keywords: string[];
      try {
        let jsonStr = result.trim();
        if (jsonStr.includes('```json')) {
          jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
        } else if (jsonStr.includes('```')) {
          jsonStr = jsonStr.split('```')[1].trim();
        }
        keywords = JSON.parse(jsonStr);
      } catch {
        // 如果JSON解析失败，尝试按行分割
        keywords = result.split('\n')
          .filter((line: string) => line.trim() !== '')
          .map((line: string) => line.trim());
      }
      
      // 确保包含原始关键词和时效性搜索词
      const essentialKeywords = [
        keyword,
        `${keyword} ${currentYear}`,
        `${keyword} 最新`,
        `${keyword} 更新`,
        `${keyword} 新特性`
      ];
      
      for (const ek of essentialKeywords) {
        if (!keywords.includes(ek)) {
          keywords.unshift(ek);
        }
      }
      
      // 去重并限制数量
      keywords = [...new Set(keywords)].slice(0, 12);
      
      console.log(`关键词扩展成功:`, keywords);
      return keywords;
    } catch (error) {
      console.error('OpenRouter API 查询扩展失败:', error);
      // 返回包含原始关键词和时效性修饰词的默认列表
      return [
        keyword,
        `${keyword} ${currentYear}`,
        `${keyword} 最新`,
        `${keyword} 更新`,
        `${keyword} 新特性`,
        `${keyword} 发布`,
        `${keyword} 讨论`
      ];
    }
  }

  /**
   * 解析分析结果
   * @param result 原始分析结果（JSON字符串）
   * @returns 结构化的分析结果
   */
  private parseAnalysisResult(result: string) {
    try {
      // 尝试提取JSON部分（有时候AI会加其他内容）
      let jsonStr = result.trim();
      
      // 如果有markdown代码块，提取里面的内容
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.split('```')[1].trim();
      }
      
      const parsed = JSON.parse(jsonStr);
      
      // 合并可能的相关字段，获取最终的分析理由
      let analysisReason = parsed.analysisReason || '暂无分析理由';
      if (parsed.relatedToKeyword && !parsed.analysisReason) {
        analysisReason = parsed.relatedToKeyword;
      } else if (parsed.relatedToKeyword) {
        analysisReason = `${analysisReason} ${parsed.relatedToKeyword}`;
      }
      
      return {
        credibilityScore: parsed.credibilityScore ?? 50,
        relevanceScore: parsed.relevanceScore ?? 50,
        importanceLevel: (parsed.importanceLevel || 'medium') as 'urgent' | 'high' | 'medium' | 'low',
        heatScore: parsed.heatScore ?? 50,
        summary: parsed.summary || '暂无摘要',
        analysisReason: analysisReason
      };
    } catch (error) {
      console.error('解析AI分析结果失败:', error, '原始内容:', result);
      
      // 简单的回退：基于关键词匹配计算相关性
      return {
        credibilityScore: 50,
        relevanceScore: 50,
        importanceLevel: 'medium' as const,
        heatScore: 50,
        summary: result.substring(0, 100),
        analysisReason: '解析失败，使用默认值'
      };
    }
  }
}

export default new OpenRouterService();