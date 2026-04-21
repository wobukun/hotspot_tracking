import express from 'express';
import prisma from '../utils/prisma';

const router = express.Router();

// 添加关键词
router.post('/', async (req, res) => {
  try {
    const { keyword } = req.body;
    
    if (!keyword) {
      return res.status(400).json({ error: { code: '400', message: '请求参数错误', details: '关键词不能为空' } });
    }

    const newKeyword = await prisma.keyword.create({
      data: { keyword }
    });

    res.status(201).json(newKeyword);
  } catch (error) {
    console.error('添加关键词失败:', error);
    res.status(500).json({ error: { code: '500', message: '服务器内部错误' } });
  }
});

// 获取关键词列表
router.get('/', async (_req, res) => {
  try {
    const keywords = await prisma.keyword.findMany();
    res.status(200).json(keywords);
  } catch (error) {
    console.error('获取关键词列表失败:', error);
    res.status(500).json({ error: { code: '500', message: '服务器内部错误' } });
  }
});

// 更新关键词状态
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const updatedKeyword = await prisma.keyword.update({
      where: { id: parseInt(id) },
      data: { isActive }
    });

    res.status(200).json(updatedKeyword);
  } catch (error) {
    console.error('更新关键词状态失败:', error);
    res.status(500).json({ error: { code: '500', message: '服务器内部错误' } });
  }
});

// 删除关键词
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const keywordId = parseInt(id);

    // 先查找关联的热点
    const hotspots = await prisma.hotspot.findMany({
      where: { keywordId },
      select: { id: true }
    });

    const hotspotIds = hotspots.map(h => h.id);

    // 删除关联的通知
    if (hotspotIds.length > 0) {
      await prisma.notification.deleteMany({
        where: { hotspotId: { in: hotspotIds } }
      });
    }

    // 删除关联的热点
    await prisma.hotspot.deleteMany({
      where: { keywordId }
    });

    // 最后删除关键词
    await prisma.keyword.delete({
      where: { id: keywordId }
    });

    res.status(200).json({ message: '关键词删除成功' });
  } catch (error) {
    console.error('删除关键词失败:', error);
    res.status(500).json({ error: { code: '500', message: '服务器内部错误' } });
  }
});

export default router;