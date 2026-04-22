# Hotspot AI 热点追踪系统

基于 Express 5 + React 19 + OpenRouter + Socket.io 开发的智能热点监控工具，实现关键词监控、多源数据采集、AI 智能分析、实时 WebSocket 推送和邮件通知功能。用户可以根据需要，设定相关的关键词（如ChatGPT），让工具从各个网站获取有关该关键词的热点信息。

## 🎯 核心功能

### 1. 多源数据采集
- **中国信息源**：B站（优先获取 B 站搜索、微博热搜、搜狗搜索
- **国际信息源**：Bing 搜索、Google 搜索、DuckDuckGo 搜索、HackerNews 搜索

### 2. AI 智能分析
- **相关性评分（0-100）
- **重要性分级**：urgent（紧急）、high（高）、medium（中）、low（低）
- **可信度评估（0-100）
- **热度计算（0-100）
- **时效性检查

### 3. 实时通知
- **WebSocket 实时推送**：新热点即时显示在页面
- **通知面板**：右上角铃铛按钮查看最新通知（保留最多 50 条）
- **邮件通知**：重要热点（high/urgent 级别）自动发送邮件
- **手动停止刷新**：用户可随时停止采集，已获取热点正常显示

### 4. 关键词管理
- 关键词增删改查
- 关键词启用/禁用
- 关键词扩展查询

### 5. 全网搜索
- **实时全网搜索**：输入关键词，立即从多个信息源搜索相关内容
- **多源覆盖**：同时从 B站、微博、搜狗、Bing、Google、DuckDuckGo、HackerNews 搜索
- **智能筛选**：AI 自动分析相关性、重要性、可信度、热度
- **时效性检查**：只显示近期内容
- **去重排序**：自动去重并按相关性排序

### 6. 热点展示
- **两种视图模式**：卡片视图/列表视图
- 按时间、来源、重要性等筛选
- 详细信息展示：标题、内容、来源、作者、浏览量、评论数、点赞数等


## 🚀 部署指南

### 前置要求

- Node.js 18+
- npm 或 yarn 或 pnpm
- 一个 OpenRouter API Key（必需）

---

## 第一步：环境准备

### 1.1 克隆项目

```bash
git clone <repository-url>
cd hotspot_tracking
```

### 1.2 安装依赖

```bash
# 安装前端依赖
cd client
npm install

# 安装后端依赖
cd ../server
npm install
```

## 第二步：配置环境变量

### 2.1 配置后端环境变量

进入后端目录，复制环境变量模板：

```bash
cd server
cp .env.example .env
```

编辑 `.env` 文件，配置以下关键变量：

```bash
# 服务器配置
PORT=3001
NODE_ENV=development

# 数据库配置（默认使用 SQLite
DATABASE_URL="file:./dev.db"

# OpenRouter API Key (必需)
# 获取地址：https://openrouter.ai/keys
OPENROUTER_API_KEY=your_openrouter_api_key_here

# 邮件通知配置（可选）
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-smtp-password
EMAIL_FROM=hotspot@example.com
EMAIL_TO=recipient@example.com

# 前端 URL（用于 CORS）
FRONTEND_URL=http://localhost:5000
```

**重要**：
- `OPENROUTER_API_KEY` 是必需配置，否则无法使用 AI 分析功能
- OpenRouter API Key 可以从 [openrouter.ai/keys](https://openrouter.ai/keys) 获取

### 2.2 配置前端环境变量（可选）

如果需要修改前端配置，可以编辑 `client/.env`：

```bash
VITE_API_URL=http://localhost:3001
```

## 第三步：数据库初始化

```bash
cd server

# 生成 Prisma 客户端
npm run prisma:generate

# 运行数据库迁移
npm run prisma:migrate
```

## 第四步：启动服务

### 4.1 启动后端服务

```bash
cd server
npm run dev
```

后端服务运行在：http://localhost:3001

**Windows 注意事项：
- 如果在 Windows 下启动后端时遇到端口占用问题，请**确保使用 PowerShell 终端**而不是 CMD 或其他终端。我们的端口清理脚本需要 PowerShell 才能正常工作。

### 4.2 启动前端服务

打开**新的终端窗口**：

```bash
cd client
npm run dev
```

前端服务运行在：http://localhost:5000

## 第五步：访问应用

在浏览器中打开：http://localhost:5000

## 端口信息

- 前端：5000
- 后端：3001

---

## 📝 其他命令

### 前端命令

```bash
# 前端目录
cd client

npm run build          # 构建生产版本
npm run preview        # 预览生产构建
npm run kill           # 清理 5000 端口
```

### 后端命令

```bash
# 后端目录
cd server

npm run build          # 构建生产版本
npm start              # 启动生产服务
npm run prisma:generate # 生成 Prisma 客户端
npm run prisma:migrate # 运行数据库迁移
npm run prisma:studio  # 打开 Prisma Studio（数据库管理界面）
npm run kill           # 清理 3001 端口
```

---

## 📚 技术栈

### 后端
- Express 5
- Prisma ORM
- Socket.io
- OpenRouter API
- Axios
- Cheerio

### 前端
- React 19
- TypeScript
- Vite
- Tailwind CSS
- Socket.io Client
- Lucide React 图标库

---

## 📄 License

MIT
