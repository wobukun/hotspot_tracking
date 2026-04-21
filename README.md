# AI 热点监控工具

基于 Express 5 + React 19 + OpenRouter + Socket.io 开发的热点监控工具，实现关键词监控、多源数据采集、AI 分析、实时推送和邮件通知功能。

## 项目结构

- `client/` - 前端 React 应用
- `server/` - 后端 Express 服务

## 快速开始

### 环境要求

- Node.js 18+

### 安装依赖

```bash
# 安装前端依赖
cd client
npm install

# 安装后端依赖
cd ../server
npm install
```

### 启动项目

#### 启动后端服务

```bash
cd server
npm run dev
```

后端服务运行在：http://localhost:3001

#### 启动前端服务

打开新的终端：

```bash
cd client
npm run dev
```

前端服务运行在：http://localhost:5000

### 端口信息

- 前端：5000
- 后端：3001

### 其他命令

#### 前端

```bash
npm run build          # 构建生产版本
npm run preview        # 预览生产构建
npm run kill           # 清理5000端口
```

#### 后端

```bash
npm run build          # 构建生产版本
npm start              # 启动生产服务
npm run prisma:generate # 生成Prisma客户端
npm run prisma:migrate # 运行数据库迁移
npm run prisma:studio  # 打开Prisma Studio
npm run kill           # 清理3001端口
```
