"""Time Utils - 时间处理工具"""

from datetime import datetime, timedelta
from typing import Optional

class TimeUtils:
    """时间工具类"""
    
    @staticmethod
    def is_within_days(date_str: str, days: int) -> bool:
        """检查日期是否在指定天数内"""
        try:
            date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            cutoff = datetime.now() - timedelta(days=days)
            return date >= cutoff
        except:
            return True
    
    @staticmethod
    def format_relative_time(date_str: str) -> str:
        """格式化相对时间"""
        try:
            date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            now = datetime.now()
            delta = now - date
            
            if delta.days > 0:
                return f"{delta.days}天前"
            elif delta.seconds >= 3600:
                return f"{delta.seconds // 3600}小时前"
            elif delta.seconds >= 60:
                return f"{delta.seconds // 60}分钟前"
            else:
                return "刚刚"
        except:
            return ""
    
    @staticmethod
    def parse_time_text(text: str) -> Optional[str]:
        """解析时间文本为ISO格式"""
        now = datetime.now()
        
        if "小时前" in text:
            import re
            match = re.search(r"(\d+)小时前", text)
            if match:
                hours = int(match.group(1))
                return (now - timedelta(hours=hours)).isoformat()
        
        if "分钟前" in text:
            import re
            match = re.search(r"(\d+)分钟前", text)
            if match:
                minutes = int(match.group(1))
                return (now - timedelta(minutes=minutes)).isoformat()
        
        if "昨天" in text:
            return (now - timedelta(days=1)).isoformat()
        
        import re
        date_match = re.search(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})", text)
        if date_match:
            try:
                date = datetime(int(date_match.group(1)), int(date_match.group(2)), int(date_match.group(3)))
                return date.isoformat()
            except:
                pass
        
        return None