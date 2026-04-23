"""Text Utils - 文本处理工具"""

import re
from typing import List, Tuple

class TextUtils:
    """文本工具类"""
    
    @staticmethod
    def clean_html(text: str) -> str:
        """清理HTML标签"""
        return re.sub(r"<[^>]*>", "", text)
    
    @staticmethod
    def extract_keywords(text: str, min_length: int = 2) -> List[str]:
        """提取关键词"""
        words = re.findall(r"[\w\u4e00-\u9fff]+", text)
        return [w for w in words if len(w) >= min_length]
    
    @staticmethod
    def calculate_similarity(text1: str, text2: str) -> float:
        """计算文本相似度"""
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())
        
        if not words1 or not words2:
            return 0.0
        
        intersection = words1 & words2
        union = words1 | words2
        
        return len(intersection) / len(union)
    
    @staticmethod
    def truncate(text: str, max_length: int = 200, suffix: str = "...") -> str:
        """截断文本"""
        if len(text) <= max_length:
            return text
        return text[:max_length - len(suffix)] + suffix
    
    @staticmethod
    def remove_extra_whitespace(text: str) -> str:
        """移除多余空白"""
        return re.sub(r"\s+", " ", text).strip()