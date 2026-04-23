"""China Sources - 国内信息源实现"""

import re
import time
import hashlib
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

import requests
from bs4 import BeautifulSoup


class ChinaSources:
    """国内信息源搜索器"""

    MIXIN_KEY_ENC_TAB = [
        46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
        33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
        61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
        36, 20, 34, 44, 52
    ]

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.timeout = config.get("timeout", {}).get("china_sources", 15)
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Referer": "https://www.bilibili.com/"
        }
        self.wbi_cache = {"img_key": "", "sub_key": "", "last_update": 0}
        self.wbi_cache_time = 3600000

    def search(self, engine: str, keyword: str, limit: int = 10) -> List[Dict[str, Any]]:
        if engine == "bilibili":
            return self._search_bilibili(keyword, limit)
        elif engine == "weibo":
            return self._get_weibo_hot(limit)
        elif engine == "sogou":
            return self._search_sogou(keyword, limit)
        else:
            return []

    def _get_wbi_keys(self) -> Dict[str, str]:
        now = time.time() * 1000

        if self.wbi_cache["img_key"] and (now - self.wbi_cache["last_update"] < self.wbi_cache_time):
            return {"img_key": self.wbi_cache["img_key"], "sub_key": self.wbi_cache["sub_key"]}

        try:
            response = requests.get(
                "https://api.bilibili.com/x/web-interface/nav",
                headers=self.headers,
                timeout=self.timeout
            )
            data = response.json().get("data", {})

            if data.get("wbi_img"):
                img_url = data["wbi_img"]["img_url"]
                sub_url = data["wbi_img"]["sub_url"]

                img_key = img_url[img_url.rfind("/") + 1:img_url.rfind(".")]
                sub_key = sub_url[sub_url.rfind("/") + 1:sub_url.rfind(".")]

                self.wbi_cache = {"img_key": img_key, "sub_key": sub_key, "last_update": now}

                return {"img_key": img_key, "sub_key": sub_key}
        except Exception as e:
            print(f"获取WBI密钥失败: {e}")

        return {
            "img_key": "7cd084941338484aae1ad9425b84077c",
            "sub_key": "4932caff0ff746eab6f01bf08b70ac45"
        }

    def _get_mixin_key(self, orig: str) -> str:
        return "".join([orig[self.MIXIN_KEY_ENC_TAB[i]] for i in range(32)])

    def _enc_wbi(self, params: Dict[str, str]) -> str:
        keys = self._get_wbi_keys()
        mixin_key = self._get_mixin_key(keys["img_key"] + keys["sub_key"])
        curr_time = int(time.time())

        params["wts"] = str(curr_time)

        chr_filter = re.compile(r"[!'()*]")

        sorted_keys = sorted(params.keys())

        query_parts = []
        for k in sorted_keys:
            v = str(params[k])
            v = chr_filter.sub("", v)
            query_parts.append(f"{self._encode_uri_component(k)}={self._encode_uri_component(v)}")
        query = "&".join(query_parts)

        wbi_sign = hashlib.md5((query + mixin_key).encode()).hexdigest()

        return f"{query}&w_rid={wbi_sign}"

    def _encode_uri_component(self, text: str) -> str:
        return requests.utils.quote(text, safe="")

    def _search_bilibili(self, keyword: str, limit: int) -> List[Dict[str, Any]]:
        results = []

        try:
            print(f"[B站API] 搜索关键词: {keyword}")

            now = time.time() * 1000
            ninety_days_ago = now - 90 * 24 * 60 * 60 * 1000

            for page in range(1, 4):
                if len(results) >= limit:
                    break

                try:
                    search_params = {
                        "keyword": keyword,
                        "search_type": "video",
                        "order": "totalrank",
                        "page": page,
                        "page_size": limit * 2
                    }

                    signed_query = self._enc_wbi(search_params)
                    url = f"https://api.bilibili.com/x/web-interface/wbi/search/type?{signed_query}"

                    response = requests.get(url, headers=self.headers, timeout=self.timeout)
                    data = response.json()

                    if data.get("code") != 0:
                        print(f"[B站API] 第{page}页搜索失败: {data.get('message')}")
                        break

                    result_data = data.get("data", {}).get("result", [])

                    if not result_data:
                        break

                    for item in result_data:
                        if len(results) >= limit:
                            break

                        view_count = item.get("play", 0) or 0
                        pubdate = item.get("pubdate", 0)

                        if view_count < 300:
                            continue

                        if pubdate:
                            video_date = pubdate * 1000
                            if video_date < ninety_days_ago:
                                continue

                        publish_time = None
                        if pubdate:
                            publish_time = datetime.fromtimestamp(pubdate).isoformat()

                        results.append({
                            "title": self._clean_html_tags(item.get("title", "")),
                            "url": f"https://www.bilibili.com/video/{item.get('bvid', '')}",
                            "content": item.get("description") or "B站视频",
                            "source": "bilibili",
                            "publish_time": publish_time,
                            "author": item.get("author"),
                            "view_count": view_count,
                            "comment_count": item.get("review"),
                            "like_count": None
                        })

                    time.sleep(0.3)

                except Exception as page_error:
                    print(f"[B站API] 第{page}页异常: {page_error}")
                    break

            if not results:
                print(f"[B站API] 没找到内容，尝试网页爬取")
                return self._search_bilibili_web(keyword, limit)

            print(f"[B站API] 找到 {len(results)} 条符合条件的热点视频")
            return results

        except Exception as error:
            print(f"[B站API] 搜索异常: {error}")
            return self._search_bilibili_web(keyword, limit)

    def _search_bilibili_web(self, keyword: str, limit: int) -> List[Dict[str, Any]]:
        results = []
        seen_urls = set()

        try:
            print(f"[B站网页] 搜索关键词: {keyword}")
            url = f"https://search.bilibili.com/all?keyword={requests.utils.quote(keyword)}&order=totalrank"
            response = requests.get(url, headers=self.headers, timeout=self.timeout)
            soup = BeautifulSoup(response.text, "lxml")

            for item in soup.select(".bili-video-card"):
                if len(results) >= limit:
                    break

                title_elem = item.select_one(".bili-video-card__info--tit")
                link_elem = item.select_one("a")
                author_elem = item.select_one(".bili-video-card__info--author")
                stats_elems = item.select(".bili-video-card__stats--item")

                if not title_elem or not link_elem:
                    continue

                title = title_elem.get_text(strip=True)
                video_url = link_elem.get("href", "")

                if not title or not video_url:
                    continue

                if video_url.startswith("//"):
                    video_url = "https:" + video_url
                elif not video_url.startswith("http"):
                    video_url = "https://www.bilibili.com" + video_url

                if video_url in seen_urls or "/video/" not in video_url:
                    continue

                seen_urls.add(video_url)

                author = author_elem.get_text(strip=True) if author_elem else None
                view_count = self._parse_number(stats_elems[0].get_text(strip=True)) if len(stats_elems) > 0 else None
                comment_count = self._parse_number(stats_elems[1].get_text(strip=True)) if len(stats_elems) > 1 else None

                if not view_count or view_count < 1000:
                    continue

                results.append({
                    "title": title,
                    "url": video_url,
                    "content": "B站视频",
                    "source": "bilibili",
                    "publish_time": None,
                    "author": author,
                    "view_count": view_count,
                    "comment_count": comment_count,
                    "like_count": None
                })

            print(f"[B站网页] 找到 {len(results)} 条符合条件的热点视频")

        except Exception as error:
            print(f"[B站网页] 搜索失败: {error}")

        return results

    def _get_weibo_hot(self, limit: int) -> List[Dict[str, Any]]:
        results = []

        try:
            url = "https://s.weibo.com/top/summary"
            response = requests.get(url, headers=self.headers, timeout=self.timeout)
            soup = BeautifulSoup(response.text, "lxml")

            for item in soup.select("td.td-02"):
                if len(results) >= limit:
                    break

                title_elem = item.select_one("a")
                hot_elem = item.select_one(".hot")

                if not title_elem:
                    continue

                title = title_elem.get_text(strip=True)
                hot_url = title_elem.get("href", "")

                if not title or not hot_url:
                    continue

                if hot_url.startswith("//"):
                    hot_url = "https:" + hot_url
                elif not hot_url.startswith("http"):
                    hot_url = "https://s.weibo.com" + hot_url

                hot_text = hot_elem.get_text(strip=True) if hot_elem else ""
                hot_number = self._parse_number(hot_text)

                results.append({
                    "title": title,
                    "url": hot_url,
                    "content": "微博热搜",
                    "source": "weibo",
                    "publish_time": datetime.now().isoformat(),
                    "author": None,
                    "view_count": hot_number,
                    "comment_count": None,
                    "like_count": None
                })

            print(f"[微博热搜] 找到 {len(results)} 条结果")

        except Exception as error:
            print(f"[微博热搜] 获取失败: {error}")

        return results

    def _search_sogou(self, keyword: str, limit: int) -> List[Dict[str, Any]]:
        results = []

        try:
            url = f"https://www.sogou.com/web?query={requests.utils.quote(keyword)}&sort=time"
            response = requests.get(url, headers=self.headers, timeout=self.timeout)
            soup = BeautifulSoup(response.text, "lxml")

            for item in soup.select(".vrwrap"):
                if len(results) >= limit:
                    break

                if item.select_one(".rb, .ad-mark") or "ad" in item.get("class", []):
                    continue

                title_elem = item.select_one("h3 a, .title a")
                content_elem = item.select_one(".str_info, .abstract, .desc")

                if not title_elem:
                    continue

                title = title_elem.get_text(strip=True)
                search_url = title_elem.get("href", "")
                content = content_elem.get_text(strip=True) if content_elem else ""

                if not title or not search_url:
                    continue

                if search_url.startswith("//"):
                    search_url = "https:" + search_url
                elif not search_url.startswith("http"):
                    search_url = "https://www.sogou.com" + search_url

                if "sogou.com" in search_url and "link" not in search_url:
                    continue

                publish_time = self._parse_time_text(item.get_text())

                negative_keywords = ["百科", "知道", "问答", "是什么", "定义", "原理", "入门", "教程"]
                if any(kw in title or kw in content for kw in negative_keywords):
                    continue

                results.append({
                    "title": title,
                    "url": search_url,
                    "content": content or "搜狗搜索结果",
                    "source": "sogou",
                    "publish_time": publish_time,
                    "author": None,
                    "view_count": None,
                    "comment_count": None,
                    "like_count": None
                })

            print(f"[搜狗搜索] 找到 {len(results)} 条结果")

        except Exception as error:
            print(f"[搜狗搜索] 搜索失败: {error}")

        return results

    def _clean_html_tags(self, text: str) -> str:
        return re.sub(r"<[^>]*>", "", text)

    def _parse_number(self, text: str) -> Optional[int]:
        if not text:
            return None

        match = re.search(r"([\d.]+)\s*[万亿千]?", text)
        if not match:
            return None

        try:
            num = float(match.group(1))
            if "万" in text:
                num *= 10000
            elif "亿" in text:
                num *= 100000000
            elif "千" in text:
                num *= 1000

            return int(num)
        except:
            return None

    def _parse_time_text(self, text: str) -> Optional[str]:
        now = datetime.now()

        if "小时前" in text:
            match = re.search(r"(\d+)小时前", text)
            if match:
                hours = int(match.group(1))
                return (now - timedelta(hours=hours)).isoformat()

        if "分钟前" in text:
            match = re.search(r"(\d+)分钟前", text)
            if match:
                minutes = int(match.group(1))
                return (now - timedelta(minutes=minutes)).isoformat()

        if "昨天" in text:
            return (now - timedelta(days=1)).isoformat()

        if "前天" in text:
            return (now - timedelta(days=2)).isoformat()

        date_match = re.search(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})", text)
        if date_match:
            try:
                date = datetime(int(date_match.group(1)), int(date_match.group(2)) - 1, int(date_match.group(3)))
                return date.isoformat()
            except:
                pass

        return None