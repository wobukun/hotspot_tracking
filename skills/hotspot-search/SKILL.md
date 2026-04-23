# Hotspot Search Skill - 热点搜索技能

## 概述

这是一个完全自包含的 AI 热点搜索技能包，支持从多个信息源搜索热点内容，无需后端服务，开箱即用。可在 Cursor、VSCode Copilot、Claude Code 等 AI 编程工具中使用。

## 功能特性

- 多数据源搜索：同时支持 7+ 信息源
  - 国内源：B站（专用API）、微博热搜、搜狗搜索
  - 国际源：Bing、Google、DuckDuckGo、HackerNews
- 智能分析：自动分析相关性、重要性、热度
- 时效性过滤：只显示90天内热点内容
- 去重排序：自动去重并按相关性排序
- 自包含：无需后端服务，开箱即用

## 在 Cursor 中部署

### 步骤 1: 创建目录结构

```powershell
mkdir skills\hotspot-search
mkdir .cursor\tools
```

### 步骤 2: 安装依赖

```powershell
cd skills\hotspot-search
pip install -r requirements.txt
cd ..
```

### 步骤 3: 创建配置文件

创建 `.cursorrules` 文件：

```powershell
@"
"""热点搜索技能配置

当用户需要搜索热点、查找最新资讯、了解行业动态时，使用 hotspot_search skill。

使用方法：
1. 导入: from hotspot_search import HotspotSearcher
2. 创建实例: searcher = HotspotSearcher()
3. 搜索: results = searcher.search("关键词", limit=10)

可用的信息源：
- bilibili: B站视频（推荐）
- weibo: 微博热搜
- sogou: 搜狗搜索
- bing: Bing搜索
- google: Google搜索
- duckduckgo: DuckDuckGo搜索
- hackernews: HackerNews
"""
"@ | Out-File -FilePath ".cursorrules" -Encoding UTF8
```

### 步骤 4: 创建工具文件

创建 `.cursor\tools\hotspot_search.py` 文件：

```powershell
@"
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "skills", "hotspot-search"))
from hotspot_search import HotspotSearcher

def search_hotspots(query: str, limit: int = 10) -> str:
    searcher = HotspotSearcher()
    results = searcher.search(query, limit=limit)
    if not results:
        return "没有找到相关热点"
    output = f"找到 {{len(results)}} 条热点：\n\n"
    for i, r in enumerate(results, 1):
        output += f"{i}. 【{r['source']}】{r['title']}\n"
        output += f"   相关度: {r['relevance_score']} | 热度: {r['heat_score']}\n"
        output += f"   链接: {r['url']}\n\n"
    return output
"@ | Out-File -FilePath ".cursor\tools\hotspot_search.py" -Encoding UTF8
```

### 步骤 5: 使用

在 Cursor 的 Chat 窗口中直接提问：

```
帮我搜索 AI 人工智能领域的最新热点，找10条结果
```

## 在 Claude Code 中部署

### 步骤 1: 创建目录结构

```powershell
mkdir .claude\tools
```

### 步骤 2: 创建配置文件

创建 `.claude\config.json` 文件：

```powershell
@"
{
  "tools": [
    {
      "name": "hotspot_search",
      "description": "搜索全球热点内容，支持 B站、微博、Google、HackerNews 等多个信息源",
      "parameters": {
        "query": {
          "type": "string",
          "description": "搜索关键词"
        },
        "limit": {
          "type": "integer",
          "description": "结果数量限制",
          "default": 10
        },
        "sources": {
          "type": "array",
          "description": "指定信息源",
          "items": {
            "type": "string",
            "enum": ["bilibili", "weibo", "sogou", "bing", "google", "duckduckgo", "hackernews"]
          }
        }
      }
    }
  ]
}
"@ | Out-File -FilePath ".claude\config.json" -Encoding UTF8
```

### 步骤 3: 创建工具文件

创建 `.claude\tools\hotspot_search.py` 文件：

```powershell
@"
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "skills", "hotspot-search"))
from hotspot_search import HotspotSearcher

def hotspot_search(query: str, limit: int = 10, sources: list = None) -> str:
    searcher = HotspotSearcher()
    results = searcher.search(query, limit=limit, sources=sources)
    if not results:
        return f"没有找到关于 '{query}' 的相关热点"
    output = f"🔍 关于 '{query}' 的热点搜索结果：\n\n"
    for i, r in enumerate(results, 1):
        output += f"{i}. 【{r['source']}】{r['title']}\n"
        output += f"   📊 相关度: {r['relevance_score']} | 🔥 热度: {r['heat_score']}\n"
        output += f"   📎 链接: {r['url']}\n\n"
    return output
"@ | Out-File -FilePath ".claude\tools\hotspot_search.py" -Encoding UTF8
```

### 步骤 4: 使用

在 Claude Code 中直接提问：

```
搜索 AI 领域的最新热点
```

## 在 Trae 中部署

### 步骤 1: 创建目录结构

```powershell
mkdir .trae\skills
```

### 步骤 2: 创建技能配置

创建 `.trae\skills\hotspot-search.json` 文件：

```powershell
@"
{
  "name": "hotspot-search",
  "version": "1.0.0",
  "description": "热点搜索技能，支持多源聚合搜索",
  "author": "Your Name",
  "entry": "skills/hotspot-search/__init__.py",
  "capabilities": [
    "search",
    "hotspot_tracking",
    "trend_analysis"
  ],
  "parameters": {
    "query": {
      "type": "string",
      "required": true,
      "description": "搜索关键词"
    },
    "limit": {
      "type": "integer",
      "default": 10,
      "description": "结果数量"
    },
    "sources": {
      "type": "array",
      "description": "指定信息源"
    }
  },
  "examples": [
    {
      "input": "搜索 AI 热点",
      "parameters": {
        "query": "AI",
        "limit": 10
      }
    },
    {
      "input": "搜索 Python 视频教程",
      "parameters": {
        "query": "Python 教程",
        "sources": ["bilibili"],
        "limit": 5
      }
    }
  ]
}
"@ | Out-File -FilePath ".trae\skills\hotspot-search.json" -Encoding UTF8
```

### 步骤 3: 创建注册表

创建 `.trae\registry.json` 文件：

```powershell
@"
{
  "skills": [
    {
      "id": "hotspot-search",
      "path": "skills/hotspot-search",
      "enabled": true,
      "priority": 10
    }
  ]
}
"@ | Out-File -FilePath ".trae\registry.json" -Encoding UTF8
```

### 步骤 4: 使用

在 Trae 的 AI 助手中：

```
使用 hotspot-search 技能搜索 AI 领域的热点
```

或直接：

```
搜索 AI 热点
```

## 在 VSCode Copilot 中部署

### 步骤 1: 创建目录结构

```powershell
mkdir .vscode\copilot
```

### 步骤 2: 创建工具文件

创建 `.vscode\copilot\hotspot_search.py` 文件：

```powershell
@"
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "skills", "hotspot-search"))
from hotspot_search import HotspotSearcher

def execute(query: str, **kwargs) -> dict:
    searcher = HotspotSearcher()
    results = searcher.search(query, **kwargs)
    return {
        "success": True,
        "data": results,
        "count": len(results)
    }
"@ | Out-File -FilePath ".vscode\copilot\hotspot_search.py" -Encoding UTF8
```

### 步骤 3: 配置 VSCode 设置

在 `.vscode\settings.json` 中添加以下配置：

```powershell
@"
{
  "github.copilot.chat.experimental.tools": [
    {
      "name": "hotspot_search",
      "description": "搜索热点内容",
      "path": "${workspaceFolder}/.vscode/copilot/hotspot_search.py"
    }
  ]
}
"@ | Out-File -FilePath ".vscode\settings.json" -Encoding UTF8
```

### 步骤 4: 使用

在 VSCode 的 Copilot Chat 中：

```
使用 hotspot_search 工具搜索 AI 热点
```

## 快速开始

### 1. 安装依赖

```powershell
cd skills\hotspot-search
pip install -r requirements.txt
```

**Python 版本要求：Python 3.8+**

**依赖包：**
- requests>=2.31.0
- beautifulsoup4>=4.12.0
- lxml>=4.9.0

### 2. 基本使用

#### Python 代码调用

```python
from hotspot_search import HotspotSearcher

searcher = HotspotSearcher()
results = searcher.search(
    query="AI 人工智能",
    limit=20
)

for result in results:
    print(f"【{result['source']}】{result['title']}")
    print(f"  相关度: {result['relevance_score']}")
    print(f"  热度: {result['heat_score']}")
    print(f"  重要性: {result['importance_level']}")
    print(f"  链接: {result['url']}")
    print()
```

#### 命令行调用

```powershell
python -m hotspot_search.search "AI 人工智能"
python -m hotspot_search.search "Python" --limit 10
python -m hotspot_search.search "机器学习" --sources bilibili,hackernews
```

### 3. 在 AI Agent 中使用

```python
from hotspot_search import HotspotSearcher

def agent_search_hotspots(query: str):
    """Agent 热点搜索工具"""
    searcher = HotspotSearcher()
    results = searcher.search(query, limit=10)
    return results

results = agent_search_hotspots("最新科技热点")
for r in results:
    print(f"- {r['title']} ({r['source']})")
```

## API 文档

### HotspotSearcher 类

#### 初始化

```python
searcher = HotspotSearcher(config_path=None)
```

**参数：**
- `config_path` (可选): 配置文件路径，默认使用内置配置

#### search() 方法

```python
searcher.search(
    query: str,              # 搜索关键词
    limit: int = 20,         # 结果数量限制
    sources: list = None,    # 指定信息源，默认全部
    min_relevance: int = 60  # 最小相关度分数
)
```

**返回值：**
```python
[
  {
    "title": "标题",
    "content": "内容摘要",
    "url": "原文链接",
    "source": "信息源名称",
    "author": "作者（若有）",
    "view_count": 浏览量（若有）,
    "comment_count": 评论数（若有）,
    "like_count": 点赞数（若有）,
    "publish_time": "发布时间(ISO格式)",
    "relevance_score": 相关度分数(0-100),
    "heat_score": 热度分数(0-100),
    "importance_level": "重要性级别(urgent/high/medium/low)"
  }
]
```

#### 可用信息源

| 信息源 | 说明 | 优先级 |
|--------|------|--------|
| bilibili | B站视频搜索（使用专用API） | 高 |
| weibo | 微博热搜 | 高 |
| sogou | 搜狗搜索 | 中 |
| bing | Bing搜索 | 低 |
| google | Google搜索 | 低 |
| duckduckgo | DuckDuckGo搜索 | 低 |
| hackernews | HackerNews | 低 |

## 高级配置

### 配置文件 (config.json)

创建 `config.json` 自定义配置：

```json
{
  "search": {
    "default_limit": 20,
    "min_relevance_score": 60,
    "max_days_old": 90
  },
  "sources": {
    "bilibili": { "enabled": true, "limit": 9 },
    "weibo": { "enabled": true, "limit": 3 },
    "sogou": { "enabled": true, "limit": 3 },
    "bing": { "enabled": true, "limit": 3 },
    "google": { "enabled": true, "limit": 3 },
    "duckduckgo": { "enabled": true, "limit": 3 },
    "hackernews": { "enabled": true, "limit": 3 }
  },
  "timeout": {
    "china_sources": 15,
    "international_sources": 8
  }
}
```

**配置说明：**
- `default_limit`: 默认返回结果数量
- `min_relevance_score`: 最小相关度分数，低于此分数的结果会被过滤
- `max_days_old`: 只显示多少天内的内容
- `sources.*.enabled`: 是否启用该信息源
- `sources.*.limit`: 每个源最多返回的结果数
- `timeout.*_sources`: 超时时间（秒）

**使用自定义配置：**

```python
searcher = HotspotSearcher(config_path="path/to/config.json")
```

## 示例

### 示例 1: 基本搜索

```python
from hotspot_search import HotspotSearcher

searcher = HotspotSearcher()
results = searcher.search("OpenAI GPT-4", limit=15)

for r in results[:5]:
    print(f"{r['title']}")
    print(f"  来源: {r['source']}")
    print(f"  相关度: {r['relevance_score']}")
    print(f"  热度: {r['heat_score']}")
    print(f"  重要性: {r['importance_level']}")
    print()
```

### 示例 2: 指定信息源

```python
results = searcher.search(
    query="Python 人工智能",
    sources=["bilibili", "hackernews"],
    limit=10
)
```

### 示例 3: 高质量结果过滤

```python
results = searcher.search(
    query="科技新闻",
    min_relevance=80,
    limit=10
)

urgent_results = [r for r in results if r['importance_level'] == 'urgent']
```

### 示例 4: 在 Agent 中集成

```python
class HotspotAgent:
    def __init__(self):
        self.searcher = HotspotSearcher()

    def search_hotspots(self, query: str) -> str:
        results = self.searcher.search(query, limit=10)

        if not results:
            return "没有找到相关热点"

        response = f"找到 {len(results)} 条相关热点：\n\n"
        for i, r in enumerate(results, 1):
            response += f"{i}. 【{r['source']}】{r['title']}\n"
            response += f"   相关度: {r['relevance_score']} | 热度: {r['heat_score']}\n"
            response += f"   链接: {r['url']}\n\n"

        return response

agent = HotspotAgent()
print(agent.search_hotspots("AI 最新进展"))
```

## 项目结构

```
hotspot-search/
├── __init__.py              # 包入口
├── search.py                # 主搜索模块
├── SKILL.md                 # 本文件
├── analysis-guide.md        # 分析框架文档
├── requirements.txt         # Python依赖
├── config.json              # 默认配置
├── sources/                 # 数据源模块
│   ├── __init__.py
│   ├── china_sources.py     # 国内源实现（B站API、微博、搜狗）
│   └── international_sources.py  # 国际源实现
└── utils/                   # 工具模块
    ├── __init__.py
    ├── time_utils.py        # 时间处理
    └── text_utils.py        # 文本处理
```

## 技术实现

### B站搜索

使用 B站 专用搜索 API `https://api.bilibili.com/x/web-interface/wbi/search/type`，实现了完整的 WBI 签名认证，与官方客户端使用相同的接口。

**WBI 签名流程：**
1. 从 `https://api.bilibili.com/x/web-interface/nav` 获取 WBI 密钥
2. 使用 mixinKey 对参数进行重排
3. 添加时间戳并计算 MD5 签名
4. 1小时自动缓存密钥

### 数据筛选策略

- **B站**：播放量≥300，90天内发布
- **微博热搜**：实时获取
- **搜狗搜索**：过滤百科、教程等非热点内容
- **HackerNews**：使用 Algolia API

### 智能分析

- **相关性评分**：基于关键词匹配度、位置、词频
- **热度评分**：浏览量40%+评论数35%+点赞数25%
- **重要性分级**：urgent/high/medium/low

## 常见问题

### Q: 搜索失败怎么办？

A: 检查以下几点：
1. 网络连接是否正常
2. 是否安装了所有依赖：`pip install -r requirements.txt`
3. 某些网站可能需要代理（如 Google）
4. B站 API 可能有访问限制，稍后重试

### Q: 如何提高搜索准确性？

A:
1. 使用更具体的关键词
2. 调整 `min_relevance` 参数
3. 指定特定信息源 `sources=["bilibili", "weibo"]`

### Q: B站搜索返回空结果？

A: 可能原因：
1. WBI 密钥过期（默认密钥可能已失效）
2. 播放量筛选条件过高（当前要求≥300）
3. 网络问题导致请求失败

## 使用场景

- 舆情监控：实时追踪热点话题
- 市场研究：了解行业动态
- 内容创作：获取创作灵感
- 知识获取：快速了解最新资讯
- Agent 工具：为 AI Agent 提供热点搜索能力

## 技术栈

- Python 3.8+
- requests：HTTP 请求
- BeautifulSoup4 + lxml：网页解析
- hashlib：WBI 签名计算

## 许可证

MIT License

---

**让 AI 帮你发现全球热点！** 🌍🔥