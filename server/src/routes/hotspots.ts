import express from 'express';
import prisma from '../utils/prisma';
import hotspotService from '../services/hotspot';

const router = express.Router();

// 获取热点列表
router.get('/', async (req, res) => {
  try {
    const { keyword, keywordId, source, importance, authenticity, publishTime, sort = 'crawlTime', page = 1, limit = 10 } = req.query;

    const where: any = {};

    if (keyword) {
      where.keyword = {
        keyword: {
          contains: keyword as string
        }
      };
    }

    if (keywordId && keywordId !== 'all') {
      where.keywordId = parseInt(keywordId as string);
    }

    if (source && source !== 'all') {
      where.source = source as string;
    }

    if (importance && importance !== 'all') {
      where.importanceLevel = importance as string;
    }

    // 真实性筛选 (trusted = >=50, doubtful = <50)
    if (authenticity && authenticity !== 'all') {
      switch (authenticity) {
        case 'trusted':
          where.credibilityScore = { gte: 50 };
          break;
        case 'doubtful':
          where.credibilityScore = { lt: 50 };
          break;
      }
    }

    // 发布时间筛选
    if (publishTime && publishTime !== 'all') {
      const now = new Date();
      let startDate: Date;
      
      switch (publishTime) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = new Date(0);
      }
      
      where.publishTime = { gte: startDate.toISOString() };
    }

    // 处理排序
    let orderBy: any = { crawlTime: 'desc' };
    switch (sort) {
      case 'publishTime':
        orderBy = { publishTime: 'desc' };
        break;
      case 'importance':
        orderBy = [
          { importanceLevel: 'desc' },
          { crawlTime: 'desc' }
        ];
        break;
      case 'relevance':
        orderBy = { relevanceScore: 'desc' };
        break;
      case 'heat':
        orderBy = { heatScore: 'desc' };
        break;
      case 'crawlTime':
      default:
        orderBy = { crawlTime: 'desc' };
        break;
    }

    const hotspots = await prisma.hotspot.findMany({
      where,
      include: {
        keyword: true
      },
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      take: parseInt(limit as string),
      orderBy
    });

    const total = await prisma.hotspot.count({ where });

    res.status(200).json({
      data: hotspots,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    console.error('获取热点列表失败:', error);
    res.status(500).json({ error: { code: '500', message: '服务器内部错误' } });
  }
});

// 获取热点详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const hotspot = await prisma.hotspot.findUnique({
      where: { id: parseInt(id) },
      include: {
        keyword: true
      }
    });

    if (!hotspot) {
      return res.status(404).json({ error: { code: '404', message: '热点不存在' } });
    }

    res.status(200).json(hotspot);
  } catch (error) {
    console.error('获取热点详情失败:', error);
    res.status(500).json({ error: { code: '500', message: '服务器内部错误' } });
  }
});

// 删除所有热点
router.delete('/', async (_req, res) => {
  try {
    const result = await prisma.hotspot.deleteMany({});
    res.status(200).json({ success: true, count: result.count });
  } catch (error) {
    console.error('删除所有热点失败:', error);
    res.status(500).json({ error: { code: '500', message: '服务器内部错误' } });
  }
});

// 全网搜索
router.post('/search', async (req, res) => {
  try {
    const { query, limit = 20 } = req.body;
    
    if (!query || !query.trim()) {
      return res.status(400).json({ error: { code: '400', message: '搜索关键词不能为空' } });
    }
    
    const results = await hotspotService.searchWeb(query, parseInt(limit));
    res.status(200).json({ data: results });
  } catch (error) {
    console.error('全网搜索失败:', error);
    res.status(500).json({ error: { code: '500', message: '服务器内部错误' } });
  }
});

export default router;