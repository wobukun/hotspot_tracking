export interface Keyword {
  id: number;
  keyword: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Hotspot {
  id: number;
  title: string;
  content: string;
  url: string;
  source: string;
  sourceId?: string;
  author?: string;
  viewCount?: number;
  commentCount?: number;
  likeCount?: number;
  publishTime?: string;
  crawlTime: string;
  relevanceScore: number;
  importanceLevel: 'urgent' | 'high' | 'medium' | 'low';
  credibilityScore: number;
  heatScore: number;
  summary: string;
  analysisReason: string;
  keywordId: number;
  keyword?: Keyword;
}

export interface Notification {
  id: number;
  type: 'email' | 'web';
  title: string;
  content: string;
  hotspotId?: number;
  isRead: boolean;
  createdAt: string;
}

export interface SystemStatus {
  status: string;
  lastCrawl: string;
  environment: string;
}

export interface SystemConfig {
  emailEnabled: boolean;
  emailTo?: string;
}

export type SortOption = 'crawlTime' | 'publishTime' | 'importance' | 'relevance' | 'heat';
export type FilterSource = 'all' | 'twitter' | 'bing' | 'google' | 'duckduckgo' | 'sogou' | 'bilibili' | 'weibo';
export type FilterImportance = 'all' | 'urgent' | 'high' | 'medium' | 'low';
export type FilterAuthenticity = 'all' | 'trusted' | 'doubtful';
export type FilterPublishTime = 'all' | 'today' | 'week' | 'month';
