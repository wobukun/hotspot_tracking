import express from 'express';
import prisma from '../utils/prisma';

const router = express.Router();

// 获取通知列表
router.get('/', async (req, res) => {
  try {
    const { type, isRead } = req.query;

    const where: any = {};

    if (type) {
      where.type = type as string;
    }

    if (isRead !== undefined) {
      where.isRead = isRead === 'true';
    }

    const notifications = await prisma.notification.findMany({
      where,
      include: {
        hotspot: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json(notifications);
  } catch (error) {
    console.error('获取通知列表失败:', error);
    res.status(500).json({ error: { code: '500', message: '服务器内部错误' } });
  }
});

// 批量标记所有通知为已读 (这个要在 :id 路由之前!)
router.put('/mark-all-read', async (_req, res) => {
  try {
    console.log('收到标记全部已读请求');
    
    // 先查看有多少未读通知
    const unreadCount = await prisma.notification.count({
      where: { isRead: false }
    });
    console.log(`当前有 ${unreadCount} 条未读通知`);
    
    // 执行批量更新
    const result = await prisma.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true }
    });

    console.log(`成功标记 ${result.count} 条通知为已读`);
    
    res.status(200).json({ 
      message: '已全部标记为已读',
      count: result.count 
    });
  } catch (error) {
    console.error('批量标记已读失败:', error);
    // 打印更详细的错误信息
    if (error instanceof Error) {
      console.error('错误详情:', error.message, error.stack);
    }
    res.status(500).json({ error: { code: '500', message: '服务器内部错误' } });
  }
});

// 标记单个通知为已读
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { isRead } = req.body;

    const updatedNotification = await prisma.notification.update({
      where: { id: parseInt(id) },
      data: { isRead: isRead !== undefined ? isRead : true }
    });

    res.status(200).json(updatedNotification);
  } catch (error) {
    console.error('标记通知为已读失败:', error);
    res.status(500).json({ error: { code: '500', message: '服务器内部错误' } });
  }
});

export default router;