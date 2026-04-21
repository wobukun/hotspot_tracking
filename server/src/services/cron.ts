import cron from 'node-cron';
import hotspotService from './hotspot';

class CronService {
  private nextHotspotUpdate: Date | null = null;
  private lastHotspotUpdate: Date | null = null;

  /**
   * 设置最后更新时间，并计算下次更新时间（+30分钟）
   */
  setLastUpdateTime(date: Date) {
    this.lastHotspotUpdate = date;
    this.nextHotspotUpdate = new Date(date.getTime() + 30 * 60 * 1000);
    console.log('上次热点更新时间:', this.lastHotspotUpdate.toLocaleString());
    console.log('下次热点更新时间:', this.nextHotspotUpdate.toLocaleString());
  }

  /**
   * 获取下次自动更新时间
   */
  getNextUpdateTime(): Date | null {
    return this.nextHotspotUpdate;
  }

  /**
   * 获取最后更新时间
   */
  getLastUpdateTime(): Date | null {
    return this.lastHotspotUpdate;
  }

  /**
   * 启动定时任务
   */
  start() {
    // 每30分钟执行一次热点采集（0分和30分执行）
    cron.schedule('0,30 * * * *', async () => {
      console.log('开始定时采集热点...');
      const now = new Date();
      await hotspotService.fetchHotspots();
      console.log('热点采集完成');
      // 更新时间
      this.setLastUpdateTime(now);
    });

    // 每天凌晨执行数据清理
    cron.schedule('0 0 * * *', async () => {
      console.log('开始清理过期数据...');
      // 清理逻辑
      console.log('数据清理完成');
    });

    console.log('定时任务已启动，不立即执行采集，等待用户手动触发或定时任务');
  }
}

export default new CronService();