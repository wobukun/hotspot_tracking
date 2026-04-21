import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import prisma from '../utils/prisma';
import hotspotService from '../services/hotspot';
import taskManager from '../services/taskManager';
import cronService from '../services/cron';

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const router = express.Router();

// 获取系统配置
router.get('/config', async (_req, res) => {
  try {
    let configs: { key: string; value: string }[] = [];
    try {
      configs = await prisma.systemConfig.findMany();
    } catch (dbError) {
      console.log('查询SystemConfig表失败，可能表还未创建，使用默认值:', dbError);
    }
    
    // 转换为对象
    const config: any = {};
    configs.forEach(c => {
      config[c.key] = c.value;
    });

    res.status(200).json({
      emailEnabled: config.emailEnabled !== 'false',
      emailTo: config.emailTo || process.env.EMAIL_TO || ''
    });
  } catch (error) {
    console.error('获取系统配置失败:', error);
    // 即使出错也返回默认配置
    res.status(200).json({
      emailEnabled: true,
      emailTo: process.env.EMAIL_TO || ''
    });
  }
});

// 更新系统配置
router.put('/config', async (req, res) => {
  try {
    const { emailEnabled, emailTo } = req.body;

    console.log('更新系统配置:', { emailEnabled, emailTo });

    // 尝试更新或创建配置
    if (emailEnabled !== undefined) {
      try {
        await prisma.systemConfig.upsert({
          where: { key: 'emailEnabled' },
          update: { value: String(emailEnabled) },
          create: { key: 'emailEnabled', value: String(emailEnabled) }
        });
      } catch (upsertError) {
        console.log('更新emailEnabled配置失败:', upsertError);
      }
    }

    if (emailTo !== undefined) {
      try {
        await prisma.systemConfig.upsert({
          where: { key: 'emailTo' },
          update: { value: emailTo },
          create: { key: 'emailTo', value: emailTo }
        });
      } catch (upsertError) {
        console.log('更新emailTo配置失败:', upsertError);
      }
    }

    res.status(200).json({
      emailEnabled: emailEnabled !== undefined ? emailEnabled : true,
      emailTo: emailTo || ''
    });
  } catch (error) {
    console.error('更新系统配置失败:', error);
    // 即使出错也返回一个成功的响应
    res.status(200).json({
      emailEnabled: true,
      emailTo: ''
    });
  }
});

// 获取系统状态（包括下次更新时间和最后更新时间）
router.get('/status', async (_req, res) => {
  try {
    const nextUpdate = cronService.getNextUpdateTime();
    const lastUpdate = cronService.getLastUpdateTime();
    res.status(200).json({
      nextHotspotUpdate: nextUpdate ? nextUpdate.toISOString() : null,
      lastHotspotUpdate: lastUpdate ? lastUpdate.toISOString() : null,
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取系统状态失败:', error);
    res.status(500).json({ error: { code: '500', message: '获取系统状态失败' } });
  }
});

// 手动触发热点采集
router.post('/crawl', async (_req, res) => {
  try {
    console.log('手动触发热点采集...');
    const now = new Date();
    // 创建任务
    const taskId = taskManager.createTask();
    // 异步执行采集，不等待完成
    hotspotService.fetchHotspots(taskId).catch(error => {
      console.error('后台热点采集失败:', error);
      taskManager.cleanupTask(taskId);
    });
    
    // 手动采集后，更新最后和下次更新时间
    cronService.setLastUpdateTime(now);
    const nextUpdate = cronService.getNextUpdateTime();
    
    res.status(200).json({ 
      message: '热点采集已启动',
      taskId: taskId,
      timestamp: now.toISOString(),
      nextHotspotUpdate: nextUpdate ? nextUpdate.toISOString() : null,
      lastHotspotUpdate: now.toISOString()
    });
  } catch (error) {
    console.error('触发热点采集失败:', error);
    res.status(500).json({ error: { code: '500', message: '触发热点采集失败' } });
  }
});

// 取消采集任务
router.post('/crawl/:taskId/cancel', async (req, res) => {
  try {
    const { taskId } = req.params;
    console.log(`取消任务 ${taskId}`);
    const success = taskManager.abortTask(taskId);
    if (success) {
      res.status(200).json({ 
        message: '任务已取消',
        taskId: taskId
      });
    } else {
      res.status(404).json({ error: { code: '404', message: '任务不存在或已完成' } });
    }
  } catch (error) {
    console.error('取消任务失败:', error);
    res.status(500).json({ error: { code: '500', message: '取消任务失败' } });
  }
});

export default router;