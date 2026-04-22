import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// API 路由
import keywordsRouter from './routes/keywords';
import hotspotsRouter from './routes/hotspots';
import notificationsRouter from './routes/notifications';
import systemRouter from './routes/system';

// 服务
import cronService from './services/cron';

// 工具
import { setIO } from './utils/socket';

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const server = http.createServer(app);

// CORS 配置
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 路由
app.get('/', (_, res) => res.send('AI 热点监控工具服务'));

// API 路由
app.use('/api/keywords', keywordsRouter);
app.use('/api/hotspots', hotspotsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/system', systemRouter);

// Socket.io 配置
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// 设置全局 io 实例
setIO(io);

// 连接管理
io.on('connection', (socket) => {
  console.log('新的客户端连接:', socket.id);
  
  // 断开连接
  socket.on('disconnect', () => {
    console.log('客户端断开连接:', socket.id);
  });
  
  // 订阅关键词
  socket.on('subscribe', (keyword) => {
    socket.join(keyword);
    console.log(`客户端 ${socket.id} 订阅了关键词: ${keyword}`);
  });
  
  // 取消订阅
  socket.on('unsubscribe', (keyword) => {
    socket.leave(keyword);
    console.log(`客户端 ${socket.id} 取消订阅了关键词: ${keyword}`);
  });
});

// 启动定时任务
cronService.start();

// 启动服务器
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`端口 ${PORT} 被占用！请先运行 "npm run kill" 清理端口后再启动`);
    process.exit(1);
  } else {
    console.error('服务器错误:', err);
  }
});

export { app, server, io };
