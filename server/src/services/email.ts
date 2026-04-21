import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // 创建邮件传输器
    this.transporter = nodemailer.createTransport({
      service: 'Gmail', // 或其他邮件服务
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  /**
   * 发送邮件
   * @param to 收件人
   * @param subject 主题
   * @param html 邮件内容
   */
  async sendEmail(to: string, subject: string, html: string) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject,
        html
      };

      return await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('邮件发送失败:', error);
      return null;
    }
  }

  /**
   * 发送热点通知邮件
   * @param to 收件人
   * @param hotspot 热点对象
   */
  async sendHotspotEmail(to: string, hotspot: any) {
    const html = `
      <h1>热点通知</h1>
      <h2>${hotspot.title}</h2>
      <p>${hotspot.summary}</p>
      <p><strong>来源:</strong> ${hotspot.source}</p>
      <p><strong>重要性:</strong> ${hotspot.importanceLevel}</p>
      <p><strong>相关性:</strong> ${hotspot.relevanceScore}/100</p>
      <a href="${hotspot.url}" target="_blank">查看原文</a>
    `;

    return await this.sendEmail(to, `[热点监控] ${hotspot.title}`, html);
  }

  /**
   * 发送批量热点通知邮件
   * @param to 收件人
   * @param hotspots 热点对象数组
   */
  async sendBulkHotspotEmail(to: string, hotspots: any[]) {
    const hotspotListHtml = hotspots.map((hotspot, index) => `
      <div style="border: 1px solid #eee; padding: 15px; margin: 10px 0; border-radius: 5px;">
        <h3 style="margin: 0 0 10px 0;">${index + 1}. ${hotspot.title}</h3>
        <p style="margin: 5px 0;">${hotspot.summary}</p>
        <p style="margin: 5px 0;"><strong>来源:</strong> ${hotspot.source}</p>
        <p style="margin: 5px 0;"><strong>重要性:</strong> ${hotspot.importanceLevel}</p>
        <p style="margin: 5px 0;"><strong>相关性:</strong> ${hotspot.relevanceScore}/100</p>
        <a href="${hotspot.url}" target="_blank" style="color: #0066cc;">查看原文</a>
      </div>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
        <h1 style="color: #333; border-bottom: 2px solid #0066cc; padding-bottom: 10px;">
          🔥 热点监控批量通知
        </h1>
        <p style="font-size: 16px; color: #666;">
          本次刷新共找到 ${hotspots.length} 个重要热点：
        </p>
        ${hotspotListHtml}
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px;">
          此邮件由热点监控系统自动发送
        </div>
      </div>
    `;

    return await this.sendEmail(to, `[热点监控] 批量通知 - ${hotspots.length} 个重要热点`, html);
  }
}

export default new EmailService();