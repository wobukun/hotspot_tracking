import prisma from '../utils/prisma';
import openrouterService from './openrouter';
import chinaSourcesService from './chinaSources';
import { getIO } from '../utils/socket';
import emailService from './email';
import taskManager from './taskManager';
import cronService from './cron';

class HotspotService {
  private readonly MAX_QUALIFIED_HOTSPOTS = 15;
  private readonly MAX_HOTSPOTS_PER_SOURCE = 3; // 每个信息源最多3条

  /**
   * 采集热点信息
   */
  async fetchHotspots(taskId?: string) {
    console.log('🚀 开始执行热点采集任务...');
    
    // 如果没有提供 taskId，创建一个新的
    const currentTaskId = taskId || taskManager.createTask();
    
    try {
      // 检查是否已取消
      if (taskManager.isTaskAborted(currentTaskId)) {
        console.log('⏹️ 任务已取消，停止采集');
        return;
      }
      
      // 获取所有激活的关键词
      const keywords = await prisma.keyword.findMany({
        where: { isActive: true }
      });

      console.log(`📝 找到 ${keywords.length} 个激活的关键词:`, keywords.map(k => k.keyword));

      if (keywords.length === 0) {
        console.log('⚠️ 没有激活的关键词，跳过采集');
        return;
      }

      const allQualifiedHotspots: any[] = [];
      const sourceCount: Record<string, number> = {}; // 记录每个来源已采集的数量

      for (const keyword of keywords) {
        // 检查是否已取消
        if (taskManager.isTaskAborted(currentTaskId)) {
          console.log('⏹️ 任务已取消，停止采集');
          break;
        }
        
        console.log(`🔍 开始采集关键词: ${keyword.keyword}`);
        try {
          const qualifiedHotspots = await this.fetchHotspotsByKeyword(keyword, allQualifiedHotspots, sourceCount, currentTaskId);
          allQualifiedHotspots.push(...qualifiedHotspots);
          
          // 检查是否已达到最大数量
          if (allQualifiedHotspots.length >= this.MAX_QUALIFIED_HOTSPOTS) {
            console.log(`✅ 已达到最大数量 ${this.MAX_QUALIFIED_HOTSPOTS}，停止采集`);
            break;
          }
          
          console.log(`✅ 完成采集关键词: ${keyword.keyword}`);
        } catch (error) {
          console.error(`❌ 关键词 ${keyword.keyword} 采集失败:`, error);
        }
      }

      // 检查是否已取消
      if (!taskManager.isTaskAborted(currentTaskId)) {
        // 统一发送邮件通知
        if (allQualifiedHotspots.length > 0) {
          await this.sendBulkEmailNotification(allQualifiedHotspots);
        }
      }

      console.log(`🎉 所有热点采集任务完成！共获取 ${allQualifiedHotspots.length} 个符合条件的热点`);
      
      // 更新最后和下次更新时间
      const now = new Date();
      cronService.setLastUpdateTime(now);
      
      // 发送采集完成的 socket 事件
      try {
        const io = getIO();
        io.emit('hotspot-complete', { 
          taskId: currentTaskId,
          count: allQualifiedHotspots.length 
        });
        console.log('📡 发送热点采集完成事件');
      } catch (error) {
        console.error('⚠️ 发送采集完成事件失败:', error);
      }
      
    } catch (error: any) {
      console.error('❌ 热点采集总任务失败:', error);
      
      // 发送采集失败的 socket 事件
      try {
        const io = getIO();
        io.emit('hotspot-error', { 
          taskId: currentTaskId,
          error: error?.message || 'Unknown error'
        });
        console.log('📡 发送热点采集失败事件');
      } catch (e) {
        console.error('⚠️ 发送采集失败事件失败:', e);
      }
      
    } finally {
      // 清理任务
      if (taskId) {
        taskManager.cleanupTask(taskId);
      }
    }
  }

  /**
   * 根据关键词采集热点信息
   * @param keyword 关键词对象
   * @param existingQualifiedHotspots 已找到的符合条件的热点
   * @param sourceCount 每个来源已采集的数量
   * @param taskId 任务 ID
   */
  private async fetchHotspotsByKeyword(
    keyword: { id: number; keyword: string }, 
    existingQualifiedHotspots: any[],
    sourceCount: Record<string, number>,
    taskId: string
  ) {
    const qualifiedHotspots: any[] = [];
    
    try {
      // 检查是否已取消
      if (taskManager.isTaskAborted(taskId)) {
        console.log('⏹️ 任务已取消，停止采集');
        return qualifiedHotspots;
      }
      
      console.log(`🔄 扩展查询关键词...`);
      // 扩展查询关键词
      let expandedKeywords: string[];
      try {
        expandedKeywords = await openrouterService.expandQuery(keyword.keyword);
        console.log(`✅ 关键词扩展成功:`, expandedKeywords);
      } catch (error) {
        console.error(`❌ OpenRouter 扩展关键词失败，使用原始关键词:`, error);
        expandedKeywords = [keyword.keyword];
      }

      // 定义信息源
      const sources = [
        { engine: 'sogou', name: '搜狗搜索' },
        { engine: 'bilibili', name: 'B站搜索' },
        { engine: 'weibo', name: '微博热搜' },
        { engine: 'bing', name: 'Bing搜索' }
      ];

      // 逐个信息源采集，每找到一个就检查
      for (const source of sources) {
        // 检查是否已取消
        if (taskManager.isTaskAborted(taskId)) {
          console.log('⏹️ 任务已取消，停止采集');
          break;
        }
        
        // 检查该来源是否已达到上限
        if ((sourceCount[source.engine] || 0) >= this.MAX_HOTSPOTS_PER_SOURCE) {
          console.log(`⏭️ ${source.name} 已达到上限 (${this.MAX_HOTSPOTS_PER_SOURCE})，跳过`);
          continue;
        }
        
        try {
          console.log(`🌐 开始从 ${source.name} 采集数据...`);
          const results = await this.fetchFromSearchEngine(source.engine, expandedKeywords);
          console.log(`📊 ${source.name} 找到 ${results.length} 条原始结果`);

          // 逐条检查
          for (const result of results) {
            // 检查是否已取消
            if (taskManager.isTaskAborted(taskId)) {
              console.log('⏹️ 任务已取消，停止采集');
              break;
            }
            
            // 检查是否已达到最大数量
            if (existingQualifiedHotspots.length + qualifiedHotspots.length >= this.MAX_QUALIFIED_HOTSPOTS) {
              break;
            }
            
            // 检查该来源是否已达到上限
            if ((sourceCount[source.engine] || 0) >= this.MAX_HOTSPOTS_PER_SOURCE) {
              console.log(`⏭️ ${source.name} 已达到上限 (${this.MAX_HOTSPOTS_PER_SOURCE})，停止继续从该来源采集`);
              break;
            }

            // 检查并处理结果
            const hotspot = await this.checkAndSaveResult(result, keyword.id, sourceCount);
            if (hotspot) {
              qualifiedHotspots.push(hotspot);
              console.log(`✅ 找到符合条件的热点: ${hotspot.title}`);
            }
          }

          // 再次检查是否达到最大数量
          if (existingQualifiedHotspots.length + qualifiedHotspots.length >= this.MAX_QUALIFIED_HOTSPOTS) {
            console.log(`✅ 已达到最大数量 ${this.MAX_QUALIFIED_HOTSPOTS}，停止采集`);
            break;
          }
        } catch (error) {
          console.error(`❌ ${source.name} 采集失败:`, error);
        }
      }

      return qualifiedHotspots;
    } catch (error) {
      console.error(`❌ 关键词 ${keyword.keyword} 总采集过程失败:`, error);
      return qualifiedHotspots;
    }
  }

  /**
   * 检查内容是否具有时效性（不过期）
   * @param result 搜索结果
   * @returns 是否具有时效性
   */
  private isContentTimely(result: any): boolean {
    try {
      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;
      
      // 如果有明确的发布时间，检查是否超过3个月
      if (result.publishTime) {
        const publishDate = new Date(result.publishTime);
        const now = new Date();
        const threeMonthsAgo = new Date(now.getTime() - 3 * 30 * 24 * 60 * 60 * 1000);
        
        if (publishDate < threeMonthsAgo) {
          console.log(`⏰ 内容发布时间超过3个月，跳过: ${result.title}`);
          return false;
        }
      }
      
      // 检查标题和内容中是否有时效性信号
      const content = `${result.title || ''} ${result.content || result.text || ''}`.toLowerCase();
      
      // 正面信号：包含近期时间或时效性词汇
      const positiveSignals = [
        `${lastYear}`, `${currentYear}`,
        '最新', '更新', '发布', '新特性', '新版本',
        '最近', '近期', '本月', '本周', '今日',
        '讨论', '新闻', '动态', '热点'
      ];
      
      // 负面信号：名词解释、百科、基础知识类词汇
      const negativeSignals = [
        '是什么', '什么是', '介绍', '百科', '知识',
        '入门', '基础', '教程', '历史', '回顾',
        '由来', '定义', '概念', '原理'
      ];
      
      // 检查是否有负面信号
      for (const signal of negativeSignals) {
        if (content.includes(signal)) {
          console.log(`📚 内容看起来是名词解释或基础知识，跳过: ${result.title}`);
          return false;
        }
      }
      
      // 如果没有明确发布时间，但有正面信号，也接受
      const hasPositiveSignal = positiveSignals.some(signal => content.includes(signal));
      if (!result.publishTime && !hasPositiveSignal) {
        console.log(`❓ 内容没有明确时效性信号，跳过: ${result.title}`);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error(`⚠️ 时效性检查出错，默认接受:`, error);
      return true; // 出错时默认接受
    }
  }

  /**
   * 科学计算热度分数（基于浏览量、评论数、点赞数，使用对数归一化）
   * @param viewCount 浏览量
   * @param commentCount 评论数
   * @param likeCount 点赞数
   * @returns 0-100 的热度分数
   */
  private calculateHeatScore(viewCount?: number, commentCount?: number, likeCount?: number): number {
    // 使用对数归一化处理数据，避免大数值垄断
    const logNormalize = (value?: number, max: number = 100000): number => {
      if (value === undefined || value <= 0) return 0;
      return Math.min(100, (Math.log10(value + 1) / Math.log10(max + 1)) * 100);
    };

    // 各项权重：浏览量40%，评论数35%，点赞数25%
    const viewScore = logNormalize(viewCount, 1000000) * 0.4;
    const commentScore = logNormalize(commentCount, 10000) * 0.35;
    const likeScore = logNormalize(likeCount, 50000) * 0.25;

    // 基础分20分 + 加权得分
    let score = 20 + viewScore + commentScore + likeScore;

    // 限制在 0-100 之间
    return Math.max(0, Math.min(100, score));
  }

  /**
   * 科学计算可信度分数
   * @param source 信息源
   * @param contentLength 内容长度
   * @param hasAuthor 是否有作者
   * @param hasMetadata 是否有元数据
   * @returns 0-100 的可信度分数
   */
  private calculateCredibilityScore(
    source?: string, 
    content?: string, 
    hasAuthor?: boolean,
    hasMetadata?: boolean
  ): number {
    let score = 40; // 基础分

    // 信息源可信度权重
    const sourceCredibility: Record<string, number> = {
      'bing': 25,
      'sogou': 20,
      'bilibili': 18,
      'weibo': 15
    };

    if (source && sourceCredibility[source]) {
      score += sourceCredibility[source];
    }

    // 内容长度加分（越长可信度越高，有上限）
    if (content) {
      const contentLength = content.length;
      if (contentLength > 500) score += 15;
      else if (contentLength > 200) score += 10;
      else if (contentLength > 50) score += 5;
    }

    // 有作者信息加分
    if (hasAuthor) score += 8;

    // 有元数据（浏览量、评论数等）加分
    if (hasMetadata) score += 7;

    // 限制在 0-100 之间
    return Math.max(0, Math.min(100, score));
  }

  /**
   * 科学计算重要性级别（基于热度、可信度、相关性综合加权）
   * @param heatScore 热度分数
   * @param credibilityScore 可信度分数
   * @param relevanceScore 相关性分数
   * @returns 重要性级别
   */
  private calculateImportanceLevel(
    heatScore: number, 
    credibilityScore: number, 
    relevanceScore: number
  ): 'urgent' | 'high' | 'medium' | 'low' {
    // 综合得分：热度40%，可信度30%，相关性30%
    const compositeScore = heatScore * 0.4 + credibilityScore * 0.3 + relevanceScore * 0.3;

    if (compositeScore >= 85) return 'urgent';
    if (compositeScore >= 70) return 'high';
    if (compositeScore >= 50) return 'medium';
    return 'low';
  }

  /**
   * 检查并保存结果
   * @param result 搜索结果
   * @param keywordId 关键词 ID
   * @param sourceCount 每个来源已采集的数量
   */
  private async checkAndSaveResult(result: any, keywordId: number, sourceCount: Record<string, number>) {
    try {
      // 首先检查时效性
      if (!this.isContentTimely(result)) {
        return null;
      }

      // 检查是否已经存在
      const existingHotspot = await prisma.hotspot.findUnique({
        where: { url: result.url }
      });

      if (existingHotspot) {
        console.log(`🔄 热点已存在，跳过: ${result.title}`);
        return null;
      }

      // 首先根据keywordId获取关键词
      const keywordObj = await prisma.keyword.findUnique({
        where: { id: keywordId }
      });
      
      if (!keywordObj) {
        console.error(`❌ 找不到关键词ID ${keywordId}`);
        return null;
      }
      
      // 分析内容 - 检查相关性、时效性等
      console.log(`🤖 开始分析热点: ${result.title}, 关键词: ${keywordObj.keyword}`);
      const content = `${result.title}\n${result.content || result.text || ''}`;
      let analysis;
      try {
        analysis = await openrouterService.analyzeContent(content, keywordObj.keyword, {
          author: result.author,
          viewCount: result.viewCount,
          commentCount: result.commentCount,
          likeCount: result.likeCount,
          source: result.source
        });
      } catch (error) {
        console.error(`❌ OpenRouter 分析失败，使用默认值:`, error);
        analysis = {
          relevanceScore: 70,
          importanceLevel: 'medium' as const,
          credibilityScore: 60,
          heatScore: 50,
          summary: content.substring(0, 200) + '...',
          analysisReason: '自动分析失败，使用默认评分'
        };
      }

      // 检查是否符合条件 - 相关性分数 >= 60（更严格）
      if (analysis.relevanceScore < 60) {
        console.log(`⚠️ 热点相关性不足 (${analysis.relevanceScore}分)，跳过: ${result.title}`);
        return null;
      }

      // 科学计算各项分数
      const heatScore = this.calculateHeatScore(result.viewCount, result.commentCount, result.likeCount);
      const hasMetadata = (result.viewCount !== undefined || result.commentCount !== undefined || result.likeCount !== undefined);
      const credibilityScore = this.calculateCredibilityScore(
        result.source, 
        content, 
        !!result.author, 
        hasMetadata
      );
      const importanceLevel = this.calculateImportanceLevel(heatScore, credibilityScore, analysis.relevanceScore);

      // 保存到数据库
      const hotspot = await prisma.hotspot.create({
        data: {
          title: result.title || '无标题',
          content: result.content || result.text || '',
          url: result.url,
          source: result.source || 'unknown',
          sourceId: result.id || result.sourceId,
          author: result.author,
          viewCount: result.viewCount,
          commentCount: result.commentCount,
          likeCount: result.likeCount,
          publishTime: result.publishTime || result.created_at,
          relevanceScore: analysis.relevanceScore,
          importanceLevel: importanceLevel,
          credibilityScore: credibilityScore,
          heatScore: heatScore,
          summary: analysis.summary,
          analysisReason: analysis.analysisReason,
          keywordId
        }
      });

      // 更新来源计数
      sourceCount[result.source] = (sourceCount[result.source] || 0) + 1;

      console.log(`💾 已保存新热点: ${hotspot.title} (来源: ${hotspot.source}, 该来源已采集: ${sourceCount[result.source]})`);

      // 立即发送 WebSocket 通知，显示在页面上
      await this.sendWebSocketNotification(hotspot);

      // 保存通知记录
      await this.saveNotificationRecord(hotspot);

      return hotspot;
    } catch (error) {
      console.error('❌ 检查并保存失败:', error);
      return null;
    }
  }

  /**
   * 从搜索引擎/信息源采集信息
   * @param engine 搜索引擎/信息源
   * @param keywords 关键词列表
   */
  private async fetchFromSearchEngine(engine: string, keywords: string[]) {
    const results = [];
    
    // 微博热搜不需要关键词，只获取一次
    if (engine === 'weibo') {
      try {
        const searchResults = await chinaSourcesService.search(engine, keywords[0] || '热搜', 5);
        results.push(...searchResults);
      } catch (error) {
        console.error(`⚠️ ${engine} 获取失败，继续:`, error);
      }
      return results;
    }

    // 其他信息源针对每个关键词搜索
    for (const keyword of keywords) {
      try {
        const searchResults = await chinaSourcesService.search(engine, keyword, 2);
        results.push(...searchResults);
      } catch (error) {
        console.error(`⚠️ ${engine} 搜索 "${keyword}" 失败，继续:`, error);
      }
    }
    
    // 去重
    const uniqueUrls = new Set();
    return results.filter(result => {
      if (!result.url) return false;
      if (uniqueUrls.has(result.url)) return false;
      uniqueUrls.add(result.url);
      return true;
    });
  }

  /**
   * 发送 WebSocket 通知 - 立即显示在页面上
   */
  private async sendWebSocketNotification(hotspot: any) {
    try {
      const io = getIO();
      io.emit('hotspot', hotspot);
      console.log('📡 WebSocket广播新热点:', hotspot.title);
    } catch (error) {
      console.error('⚠️ WebSocket广播失败:', error);
    }
  }

  /**
   * 保存通知记录
   */
  private async saveNotificationRecord(hotspot: any) {
    try {
      await prisma.notification.create({
        data: {
          type: 'web',
          title: hotspot.title,
          content: hotspot.summary,
          hotspotId: hotspot.id
        }
      });
    } catch (error) {
      console.error('⚠️ 保存通知记录失败:', error);
    }
  }

  /**
   * 统一发送邮件通知
   */
  private async sendBulkEmailNotification(hotspots: any[]) {
    try {
      // 筛选 high 和 urgent 级别的热点
      const importantHotspots = hotspots.filter(
        h => h.importanceLevel === 'high' || h.importanceLevel === 'urgent'
      );

      if (importantHotspots.length === 0) {
        console.log('⚠️ 没有重要级别热点，跳过邮件通知');
        return;
      }

      const emailTo = process.env.EMAIL_TO;
      if (!emailTo) {
        console.log('⚠️ EMAIL_TO 未配置，跳过邮件通知');
        return;
      }

      // 发送批量邮件
      await emailService.sendBulkHotspotEmail(emailTo, importantHotspots);
      console.log(`📧 已发送批量邮件通知，包含 ${importantHotspots.length} 个重要热点`);
    } catch (error) {
      console.error('⚠️ 批量邮件通知发送失败:', error);
    }
  }

  /**
   * 全网搜索功能
   * @param query 搜索关键词
   * @param limit 结果数量限制
   */
  async searchWeb(query: string, limit: number = 20) {
    console.log(`🔍 开始全网搜索: ${query}`);
    
    const results = [];
    
    // 定义信息源
    const sources = [
      { engine: 'sogou', name: '搜狗搜索' },
      { engine: 'bilibili', name: 'B站搜索' },
      { engine: 'weibo', name: '微博热搜' },
      { engine: 'bing', name: 'Bing搜索' }
    ];

    // 逐个信息源搜索
    for (const source of sources) {
      try {
        console.log(`🌐 开始从 ${source.name} 搜索...`);
        const searchResults = await chinaSourcesService.search(source.engine, query, 3);
        console.log(`📊 ${source.name} 找到 ${searchResults.length} 条结果`);
        
        // 分析每条搜索结果
        for (const result of searchResults) {
          try {
            // 首先检查时效性
            if (!this.isContentTimely(result)) {
              continue;
            }

            const content = `${result.title}\n${result.content || ''}`;
            let analysis;
            try {
              analysis = await openrouterService.analyzeContent(content, query, {
                author: result.author,
                viewCount: result.viewCount,
                commentCount: result.commentCount,
                likeCount: result.likeCount,
                source: result.source
              });
            } catch (error) {
              console.error(`❌ OpenRouter 分析失败，使用默认值:`, error);
              analysis = {
                relevanceScore: 70,
                importanceLevel: 'medium' as const,
                credibilityScore: 60,
                heatScore: 50,
                summary: content.substring(0, 200) + '...',
                analysisReason: '自动分析失败，使用默认评分'
              };
            }

            // 计算热度分数
            const manualHeatScore = this.calculateHeatScore(result.viewCount, result.commentCount, result.likeCount);

            results.push({
              title: result.title || '无标题',
              content: result.content || '',
              url: result.url,
              source: result.source || source.engine,
              author: result.author,
              viewCount: result.viewCount,
              commentCount: result.commentCount,
              likeCount: result.likeCount,
              publishTime: result.publishTime,
              relevanceScore: analysis.relevanceScore,
              importanceLevel: analysis.importanceLevel,
              credibilityScore: analysis.credibilityScore,
              heatScore: manualHeatScore,
              summary: analysis.summary,
              analysisReason: analysis.analysisReason,
              searchQuery: query
            });
          } catch (error) {
            console.error(`❌ 处理 ${source.name} 结果失败:`, error);
          }
        }
      } catch (error) {
        console.error(`❌ ${source.name} 搜索失败:`, error);
      }
    }

    // 按相关性分数排序
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    // 去重
    const uniqueUrls = new Set();
    const uniqueResults = results.filter(result => {
      if (!result.url) return false;
      if (uniqueUrls.has(result.url)) return false;
      uniqueUrls.add(result.url);
      return true;
    });

    console.log(`🎉 全网搜索完成！共找到 ${uniqueResults.length} 条结果`);
    
    return uniqueResults.slice(0, limit);
  }
}

export default new HotspotService();
