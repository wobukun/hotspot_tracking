"""Hotspot Search - 主搜索模块"""

import json
import os
import time
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sources.china_sources import ChinaSources
from sources.international_sources import InternationalSources


class HotspotSearcher:
    """热点搜索器"""

    def __init__(self, config_path: Optional[str] = None):
        """初始化搜索器"""
        self.config = self._load_config(config_path)
        self.china_sources = ChinaSources(self.config)
        self.international_sources = InternationalSources(self.config)

    def _load_config(self, config_path: Optional[str]) -> Dict[str, Any]:
        """加载配置"""
        if config_path and os.path.exists(config_path):
            with open(config_path, 'r', encoding='utf-8') as f:
                return json.load(f)

        return {
            "search": {
                "default_limit": 20,
                "min_relevance_score": 60,
                "max_days_old": 90
            },
            "sources": {
                "bilibili": {"enabled": True, "limit": 9},
                "weibo": {"enabled": True, "limit": 3},
                "sogou": {"enabled": True, "limit": 3},
                "bing": {"enabled": True, "limit": 3},
                "google": {"enabled": True, "limit": 3},
                "duckduckgo": {"enabled": True, "limit": 3},
                "hackernews": {"enabled": True, "limit": 3}
            },
            "timeout": {
                "china_sources": 15,
                "international_sources": 8
            }
        }

    def search(
        self,
        query: str,
        limit: int = 20,
        sources: Optional[List[str]] = None,
        min_relevance: int = 60
    ) -> List[Dict[str, Any]]:
        """搜索热点"""
        print(f"开始搜索: {query}")
        start_time = time.time()

        all_results = []
        source_count = {}

        # 定义搜索源顺序（国内优先）
        search_sources = [
            # 国内源
            {"engine": "bilibili", "name": "B站", "service": self.china_sources},
            {"engine": "weibo", "name": "微博", "service": self.china_sources},
            {"engine": "sogou", "name": "搜狗", "service": self.china_sources},
            # 国际源
            {"engine": "bing", "name": "Bing", "service": self.international_sources},
            {"engine": "google", "name": "Google", "service": self.international_sources},
            {"engine": "duckduckgo", "name": "DuckDuckGo", "service": self.international_sources},
            {"engine": "hackernews", "name": "HackerNews", "service": self.international_sources}
        ]

        # 过滤指定的信息源
        if sources:
            search_sources = [s for s in search_sources if s["engine"] in sources]

        # 逐个搜索
        for source in search_sources:
            if len(all_results) >= limit:
                break

            engine = source["engine"]
            source_config = self.config["sources"].get(engine, {})

            if not source_config.get("enabled", True):
                continue

            source_limit = source_config.get("limit", 3)
            if engine == "bilibili":
                source_limit = min(source_limit, 9)

            if source_count.get(engine, 0) >= source_limit:
                continue

            try:
                print(f"正在搜索 {source['name']}...")
                results = source["service"].search(
                    engine=engine,
                    keyword=query,
                    limit=min(source_limit * 2, limit)
                )

                # 处理结果
                for result in results:
                    if len(all_results) >= limit:
                        break

                    if source_count.get(engine, 0) >= source_limit:
                        break

                    # 时效性检查
                    if not self._is_timely(result):
                        continue

                    # 计算相关性分数
                    relevance_score = self._calculate_relevance(result, query)

                    if relevance_score < min_relevance:
                        continue

                    # 计算热度分数
                    heat_score = self._calculate_heat_score(result)

                    # 构建完整结果
                    processed_result = {
                        "title": result.get("title", ""),
                        "content": result.get("content", ""),
                        "url": result.get("url", ""),
                        "source": result.get("source", engine),
                        "author": result.get("author"),
                        "view_count": result.get("view_count"),
                        "comment_count": result.get("comment_count"),
                        "like_count": result.get("like_count"),
                        "publish_time": result.get("publish_time"),
                        "relevance_score": relevance_score,
                        "importance_level": self._estimate_importance(relevance_score, heat_score),
                        "heat_score": heat_score,
                    }

                    all_results.append(processed_result)
                    source_count[engine] = source_count.get(engine, 0) + 1

                print(f"{source['name']} 找到 {len(results)} 条结果")

            except Exception as e:
                print(f"{source['name']} 搜索失败: {e}")

        # 排序：按相关性降序
        all_results.sort(key=lambda x: (-x["relevance_score"], -x["heat_score"]))

        # 去重
        all_results = self._remove_duplicates(all_results)

        # 限制数量
        all_results = all_results[:limit]

        elapsed = time.time() - start_time
        print(f"搜索完成！找到 {len(all_results)} 条结果，耗时 {elapsed:.2f}秒")

        return all_results

    def _is_timely(self, result: Dict[str, Any]) -> bool:
        """检查内容时效性"""
        max_days = self.config["search"]["max_days_old"]
        publish_time = result.get("publish_time")

        if not publish_time:
            return True

        try:
            pub_date = datetime.fromisoformat(publish_time.replace('Z', '+00:00'))
            cutoff = datetime.now() - timedelta(days=max_days)
            return pub_date >= cutoff
        except:
            return True

    def _calculate_relevance(self, result: Dict[str, Any], query: str) -> int:
        """计算相关性分数"""
        title = result.get("title", "").lower()
        content = result.get("content", "").lower()
        query_lower = query.lower()

        score = 50  # 基础分

        # 标题匹配
        if query_lower in title:
            score += 30

        # 内容匹配
        if query_lower in content:
            score += 15

        # 关键词词频
        title_count = title.count(query_lower)
        content_count = content.count(query_lower)
        score += min(title_count + content_count, 5)

        return min(score, 100)

    def _calculate_heat_score(self, result: Dict[str, Any]) -> int:
        """计算热度分数"""
        view_count = result.get("view_count", 0) or 0
        comment_count = result.get("comment_count", 0) or 0
        like_count = result.get("like_count", 0) or 0

        # 归一化并加权
        view_score = min(view_count / 10000, 1) * 40
        comment_score = min(comment_count / 1000, 1) * 35
        like_score = min(like_count / 5000, 1) * 25

        return int(view_score + comment_score + like_score)

    def _estimate_importance(self, relevance: int, heat: int) -> str:
        """估算重要性级别"""
        combined = (relevance + heat) / 2

        if combined >= 85:
            return "urgent"
        elif combined >= 70:
            return "high"
        elif combined >= 50:
            return "medium"
        else:
            return "low"

    def _remove_duplicates(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """去重"""
        seen_urls = set()
        unique_results = []

        for result in results:
            url = result.get("url", "")
            if url and url not in seen_urls:
                seen_urls.add(url)
                unique_results.append(result)

        return unique_results


def main():
    """命令行入口"""
    import sys

    if len(sys.argv) < 2:
        print("用法: python -m hotspot_search.search <关键词> [--limit N]")
        print("示例: python -m hotspot_search.search \"AI 人工智能\" --limit 20")
        return

    query = sys.argv[1]
    limit = 20

    # 解析参数
    for i, arg in enumerate(sys.argv):
        if arg == "--limit" and i + 1 < len(sys.argv):
            limit = int(sys.argv[i + 1])

    searcher = HotspotSearcher()
    results = searcher.search(query, limit=limit)

    print(f"\n找到 {len(results)} 条结果:\n")
    for i, result in enumerate(results, 1):
        print(f"{i}. [{result['source']}] {result['title']}")
        print(f"   链接: {result['url']}")
        print(f"   相关度: {result['relevance_score']}, 热度: {result['heat_score']}")
        print(f"   重要性: {result['importance_level']}")
        print()


if __name__ == "__main__":
    main()