"""International Sources - 国际信息源实现"""

import re
import time
from typing import List, Dict, Any
from datetime import datetime

import requests
from bs4 import BeautifulSoup


class InternationalSources:
    """国际信息源搜索器"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.timeout = config.get("timeout", {}).get("international_sources", 8)
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
        }

    def search(self, engine: str, keyword: str, limit: int = 10) -> List[Dict[str, Any]]:
        """搜索国际信息源"""
        if engine == "bing":
            return self._search_bing(keyword, limit)
        elif engine == "google":
            return self._search_google(keyword, limit)
        elif engine == "duckduckgo":
            return self._search_duckduckgo(keyword, limit)
        elif engine == "hackernews":
            return self._search_hackernews(keyword, limit)
        else:
            return []

    def _search_bing(self, keyword: str, limit: int) -> List[Dict[str, Any]]:
        """Bing 搜索"""
        results = []

        try:
            url = f"https://www.bing.com/search?q={requests.utils.quote(keyword)}&setlang=en-US"
            response = requests.get(url, headers=self.headers, timeout=self.timeout)
            soup = BeautifulSoup(response.text, "lxml")

            for item in soup.select(".b_algo, li.b_algo"):
                if len(results) >= limit:
                    break

                title_elem = item.select_one("h2 a")
                if not title_elem:
                    continue

                title = title_elem.get_text(strip=True)
                url = title_elem.get("href", "")
                content_elem = item.select_one(".b_caption p")
                content = content_elem.get_text(strip=True) if content_elem else ""

                if title and url and url.startswith("http") and "bing.com" not in url:
                    results.append({
                        "title": title,
                        "url": url,
                        "content": content or "Bing搜索",
                        "source": "bing",
                        "publish_time": None,
                        "author": None,
                        "view_count": None,
                        "comment_count": None,
                        "like_count": None
                    })

            if not results:
                print(f"[Bing] 没有找到结果")
                return results

            print(f"[Bing] 找到 {len(results)} 条结果")

        except Exception as error:
            print(f"[Bing] 搜索失败: {error}")

        return results

    def _search_google(self, keyword: str, limit: int) -> List[Dict[str, Any]]:
        """Google 搜索"""
        results = []

        try:
            url = f"https://www.google.com/search?q={requests.utils.quote(keyword)}&hl=en"
            response = requests.get(url, headers=self.headers, timeout=self.timeout)
            soup = BeautifulSoup(response.text, "lxml")

            for item in soup.select("div.g"):
                if len(results) >= limit:
                    break

                title_elem = item.select_one("h3")
                link_elem = item.select_one("a")
                content_elem = item.select_one("div.VwiC3b")

                if not title_elem or not link_elem:
                    continue

                title = title_elem.get_text(strip=True)
                url = link_elem.get("href", "")
                content = content_elem.get_text(strip=True) if content_elem else ""

                # 处理Google的URL格式
                if url.startswith("/url?q="):
                    url = requests.utils.unquote(url.replace("/url?q=", "").split("&")[0])

                if title and url and url.startswith("http") and "google.com" not in url:
                    results.append({
                        "title": title,
                        "url": url,
                        "content": content or "Google搜索",
                        "source": "google",
                        "publish_time": None,
                        "author": None,
                        "view_count": None,
                        "comment_count": None,
                        "like_count": None
                    })

            if not results:
                print(f"[Google] 没有找到结果")

            print(f"[Google] 找到 {len(results)} 条结果")

        except Exception as error:
            print(f"[Google] 搜索失败: {error}")

        return results

    def _search_duckduckgo(self, keyword: str, limit: int) -> List[Dict[str, Any]]:
        """DuckDuckGo 搜索"""
        results = []

        try:
            url = f"https://duckduckgo.com/html/?q={requests.utils.quote(keyword)}"
            response = requests.get(url, headers=self.headers, timeout=self.timeout)
            soup = BeautifulSoup(response.text, "lxml")

            for item in soup.select(".result"):
                if len(results) >= limit:
                    break

                title_elem = item.select_one(".result__title a")
                content_elem = item.select_one(".result__snippet")

                if not title_elem:
                    continue

                title = title_elem.get_text(strip=True)
                url = title_elem.get("href", "")
                content = content_elem.get_text(strip=True) if content_elem else ""

                if title and url and url.startswith("http"):
                    results.append({
                        "title": title,
                        "url": url,
                        "content": content or "DuckDuckGo搜索",
                        "source": "duckduckgo",
                        "publish_time": None,
                        "author": None,
                        "view_count": None,
                        "comment_count": None,
                        "like_count": None
                    })

            if not results:
                print(f"[DuckDuckGo] 没有找到结果")

            print(f"[DuckDuckGo] 找到 {len(results)} 条结果")

        except Exception as error:
            print(f"[DuckDuckGo] 搜索失败: {error}")

        return results

    def _search_hackernews(self, keyword: str, limit: int) -> List[Dict[str, Any]]:
        """HackerNews 搜索"""
        results = []

        try:
            url = f"https://hn.algolia.com/api/v1/search?query={requests.utils.quote(keyword)}&tags=story&hitsPerPage={limit}"
            response = requests.get(url, headers=self.headers, timeout=self.timeout)
            data = response.json()

            for hit in data.get("hits", []):
                if len(results) >= limit:
                    break

                title = hit.get("title", "")
                url = hit.get("url") or f"https://news.ycombinator.com/item?id={hit.get('objectID')}"
                author = hit.get("author")
                points = hit.get("points", 0)
                comments = hit.get("num_comments", 0)

                publish_time = None
                if hit.get("created_at_i"):
                    publish_time = datetime.fromtimestamp(hit["created_at_i"]).isoformat()

                if title:
                    results.append({
                        "title": title,
                        "url": url,
                        "content": f"Hacker News 热门话题，热度: {points} 点",
                        "source": "hackernews",
                        "publish_time": publish_time,
                        "author": author,
                        "view_count": points,
                        "comment_count": comments,
                        "like_count": points
                    })

            if not results:
                print(f"[HackerNews] 没有找到结果")

            print(f"[HackerNews] 找到 {len(results)} 条结果")

        except Exception as error:
            print(f"[HackerNews] 搜索失败: {error}")

        return results