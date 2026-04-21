import { useState, useEffect, useMemo, useRef } from 'react';
import { keywordsApi, hotspotsApi, systemApi } from '../services/api';
import { Keyword, Hotspot, SortOption, FilterSource, FilterImportance, FilterAuthenticity, FilterPublishTime } from '../types';
import { AlertTriangle, Clock, ExternalLink, Plus, Search, Trash2, Edit2, X, Check, Flame, Zap, BookOpen, RotateCcw, Filter, ArrowUpDown, LayoutGrid, List, ChevronDown, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useRefresh } from '../App';
import { socketService } from '../services/socket';
import { CustomSelect } from '../components/CustomSelect';

type ViewMode = 'radar' | 'keywords';
type HotspotViewMode = 'card' | 'list';

export default function Dashboard() {
  const [viewMode, setViewMode] = useState<ViewMode>('radar');
  const { keywords, refreshKeywords } = useRefresh();
  const [localHotspots, setLocalHotspots] = useState<Hotspot[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  
  // 新增：热点筛选和排序
  const [sort, setSort] = useState<SortOption>('crawlTime');
  const [showFilters, setShowFilters] = useState(false);
  const [filterSource, setFilterSource] = useState<FilterSource>('all');
  const [filterImportance, setFilterImportance] = useState<FilterImportance>('all');
  const [filterAuthenticity, setFilterAuthenticity] = useState<FilterAuthenticity>('all');
  const [filterPublishTime, setFilterPublishTime] = useState<FilterPublishTime>('all');
  const [filterKeywordId, setFilterKeywordId] = useState<number | 'all'>('all');
  const [hotspotViewMode, setHotspotViewMode] = useState<HotspotViewMode>('list');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  
  // 时间相关状态
  const [lastUpdateTime, setLastUpdateTime] = useState<string | null>(null);
  const [nextUpdateTime, setNextUpdateTime] = useState<string | null>(null);
  const [countdownText, setCountdownText] = useState<string>('');
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 加载系统状态
  const loadSystemStatus = async () => {
    try {
      const status = await systemApi.getSystemStatus();
      if (status.lastHotspotUpdate) {
        setLastUpdateTime(status.lastHotspotUpdate);
      }
      if (status.nextHotspotUpdate) {
        setNextUpdateTime(status.nextHotspotUpdate);
      }
    } catch (error) {
      console.error('Failed to load system status:', error);
    }
  };

  // 更新倒计时
  const updateCountdown = () => {
    if (!nextUpdateTime) return;
    const now = new Date();
    const next = new Date(nextUpdateTime);
    const diffMs = next.getTime() - now.getTime();
    
    if (diffMs <= 0) {
      setCountdownText('即将更新');
      return;
    }
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    if (diffMinutes > 0) {
      setCountdownText(`${diffMinutes}分${diffSeconds}秒`);
    } else {
      setCountdownText(`${diffSeconds}秒`);
    }
  };

  // 加载热点数据
  const loadHotspots = async () => {
    try {
      setLoading(true);
      const response = await hotspotsApi.getAll({ 
        limit: 50, 
        sort, 
        source: filterSource, 
        importance: filterImportance 
      });
      const data = Array.isArray(response) ? response : (response.data || []);
      setLocalHotspots(data);
    } catch (error) {
      console.error('Failed to load hotspots:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载和筛选排序变更时重新加载
  useEffect(() => {
    loadHotspots();
  }, [sort, filterSource, filterImportance]);

  // 监听socket新热点
  useEffect(() => {
    const handleNewHotspot = (newHotspot: Hotspot) => {
      console.log('Dashboard收到新热点:', newHotspot);
      setLocalHotspots(prev => {
        if (prev.find(h => h.id === newHotspot.id)) return prev;
        return [newHotspot, ...prev];
      });
    };

    socketService.on('hotspot', handleNewHotspot);

    return () => {
      socketService.off('hotspot', handleNewHotspot);
    };
  }, []);

  // 初始加载系统状态
  useEffect(() => {
    loadSystemStatus();
  }, []);

  // 倒计时定时器
  useEffect(() => {
    updateCountdown();
    countdownIntervalRef.current = setInterval(updateCountdown, 1000);
    
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [nextUpdateTime]);

  // 监听刷新状态变化
  const { refreshing } = useRefresh();
  useEffect(() => {
    if (!refreshing) {
      loadSystemStatus();
    }
  }, [refreshing]);

  const handleReset = async () => {
    try {
      await hotspotsApi.deleteAll();
      setLocalHotspots([]);
    } catch (error) {
      console.error('重置热点失败:', error);
    }
  };

  // 全网搜索功能
  const handleSearch = async (query?: string) => {
    const searchTerm = query || searchQuery;
    if (!searchTerm.trim()) return;
    
    try {
      setIsSearching(true);
      setShowSearchResults(true);
      const response = await hotspotsApi.search(searchTerm.trim(), 20);
      setSearchResults(response.data || []);
    } catch (error) {
      console.error('搜索失败:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) return;
    try {
      await keywordsApi.create(newKeyword.trim());
      setNewKeyword('');
      setShowAddModal(false);
      refreshKeywords();
    } catch (error) {
      console.error('Failed to add keyword:', error);
    }
  };

  const handleToggleActive = async (e: React.MouseEvent, keyword: Keyword) => {
    e.stopPropagation();
    try {
      await keywordsApi.update(keyword.id, { isActive: !keyword.isActive });
      refreshKeywords();
    } catch (error) {
      console.error('Failed to toggle keyword:', error);
    }
  };

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setDeletingId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await keywordsApi.delete(deletingId);
      refreshKeywords();
      setShowDeleteModal(false);
      setDeletingId(null);
    } catch (error) {
      console.error('Failed to delete keyword:', error);
    }
  };

  const handleStartEdit = (e: React.MouseEvent, keyword: Keyword) => {
    e.stopPropagation();
    setEditingId(keyword.id);
    setEditValue(keyword.keyword);
  };

  const handleSaveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editValue.trim() || !editingId) return;
    try {
      await keywordsApi.update(editingId, { keyword: editValue.trim() });
      setEditingId(null);
      setEditValue('');
      refreshKeywords();
    } catch (error) {
      console.error('Failed to update keyword:', error);
    }
  };

  const safeHotspots = Array.isArray(localHotspots) ? localHotspots : [];
  const safeKeywords = Array.isArray(keywords) ? keywords : [];

  // 前端筛选逻辑
  const filteredHotspots = useMemo(() => {
    let result = [...safeHotspots];

    // 来源筛选
    if (filterSource !== 'all') {
      result = result.filter(h => h.source === filterSource);
    }

    // 重要程度筛选
    if (filterImportance !== 'all') {
      result = result.filter(h => h.importanceLevel === filterImportance);
    }

    // 关键词筛选
    if (filterKeywordId !== 'all') {
      result = result.filter(h => h.keywordId === filterKeywordId);
    }

    // 发布时间筛选
    if (filterPublishTime !== 'all') {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - 7);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      result = result.filter(h => {
        if (!h.publishTime) return false;
        const publishDate = new Date(h.publishTime);
        switch (filterPublishTime) {
          case 'today':
            return publishDate >= todayStart;
          case 'week':
            return publishDate >= weekStart;
          case 'month':
            return publishDate >= monthStart;
          default:
            return true;
        }
      });
    }

    // 真实性筛选
    if (filterAuthenticity !== 'all') {
      result = result.filter(h => {
        switch (filterAuthenticity) {
          case 'trusted':
            return h.credibilityScore >= 50;
          case 'doubtful':
            return h.credibilityScore < 50;
          default:
            return true;
        }
      });
    }

    // 排序
    result.sort((a, b) => {
      switch (sort) {
        case 'crawlTime':
          return new Date(b.crawlTime).getTime() - new Date(a.crawlTime).getTime();
        case 'publishTime':
          if (!a.publishTime) return 1;
          if (!b.publishTime) return -1;
          return new Date(b.publishTime).getTime() - new Date(a.publishTime).getTime();
        case 'importance':
          const importanceOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          return importanceOrder[b.importanceLevel] - importanceOrder[a.importanceLevel];
        case 'relevance':
          return b.relevanceScore - a.relevanceScore;
        case 'heat':
          return (b.heatScore || 0) - (a.heatScore || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [safeHotspots, filterSource, filterImportance, filterKeywordId, filterPublishTime, filterAuthenticity, sort]);
  const filteredKeywords = safeKeywords.filter(k =>
    k.keyword.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: safeHotspots.length,
    urgent: safeHotspots.filter(h => h.importanceLevel === 'urgent').length,
    high: safeHotspots.filter(h => h.importanceLevel === 'high').length,
    activeKeywords: safeKeywords.filter(k => k.isActive).length,
  };

  const importanceColor = (level: string) => {
    switch (level) {
      case 'urgent': return 'bg-red-100 text-red-700 border border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border border-orange-200';
      case 'medium': return 'bg-amber-100 text-amber-700 border border-amber-200';
      case 'low': return 'bg-gray-100 text-gray-600 border border-gray-200';
      default: return 'bg-gray-100 text-gray-600 border border-gray-200';
    }
  };

  const sourceColors: Record<string, string> = {
    twitter: 'bg-blue-100 text-blue-700 border border-blue-200',
    bing: 'bg-green-100 text-green-700 border border-green-200',
    google: 'bg-red-100 text-red-700 border border-red-200',
    duckduckgo: 'bg-orange-100 text-orange-700 border border-orange-200',
    sogou: 'bg-blue-100 text-blue-700 border border-blue-200',
    bilibili: 'bg-pink-100 text-pink-700 border border-pink-200',
    weibo: 'bg-red-100 text-red-700 border border-red-200',
  };

  const formatNumber = (num: number | undefined | null): string => {
    if (num === undefined || num === null) return '';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 10000) return (num / 10000).toFixed(1) + '万';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatRelativeTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return '刚刚';
      if (diffMins < 60) return `${diffMins}分钟前`;
      if (diffHours < 24) return `${diffHours}小时前`;
      if (diffDays < 7) return `${diffDays}天前`;
      
      return date.toLocaleDateString('zh-CN', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '时间未知';
    }
  };

  return (
    <div className="space-y-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex bg-orange-50 rounded-xl p-1.5">
            <button
              onClick={() => {
                setViewMode('radar');
                setShowSearchResults(false);
              }}
              className={`px-6 py-2.5 rounded-xl transition-all duration-200 font-medium ${
                viewMode === 'radar' && !showSearchResults
                  ? 'bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-white shadow-xl shadow-orange-300/40'
                  : 'text-orange-700 hover:text-[#F97316] hover:bg-white/50'
              }`}
            >
              热点雷达
            </button>
            <button
              onClick={() => {
                setViewMode('keywords');
                setShowSearchResults(false);
              }}
              className={`px-6 py-2.5 rounded-xl transition-all duration-200 font-medium ${
                viewMode === 'keywords'
                  ? 'bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-white shadow-xl shadow-orange-300/40'
                  : 'text-orange-700 hover:text-[#F97316] hover:bg-white/50'
              }`}
            >
              监控词
            </button>
            <button
              onClick={() => {
                setShowSearchResults(true);
                setViewMode('radar');
              }}
              className={`px-6 py-2.5 rounded-xl transition-all duration-200 font-medium ${
                showSearchResults
                  ? 'bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-white shadow-xl shadow-orange-300/40'
                  : 'text-orange-700 hover:text-[#F97316] hover:bg-white/50'
              }`}
            >
              全网搜索
            </button>
          </div>
        </div>
        
        {viewMode === 'radar' && !showSearchResults && (
          <div className="flex items-center gap-4">
            <div className="text-sm text-orange-600 flex items-center gap-2">
              <Clock size={16} className="text-[#F97316]" />
              <span>最后更新: {lastUpdateTime ? new Date(lastUpdateTime).toLocaleTimeString() : '暂无'}</span>
            </div>
            {countdownText && (
              <div className="text-sm text-orange-600 flex items-center gap-2">
                <span>|</span>
                <span>下次自动更新: {countdownText}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {viewMode === 'radar' && !showSearchResults && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 总热点 */}
            <div className="bg-white border border-orange-100 rounded-2xl p-6 hover:shadow-xl hover:shadow-orange-200/40 transition-all duration-300 relative overflow-hidden group cursor-pointer">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-50 to-orange-50/0 group-hover:from-orange-100 group-hover:to-orange-50/0 transition-all duration-300"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-gradient-to-br from-orange-100 to-orange-50 rounded-xl">
                    <Flame className="text-[#F97316]" size={22} />
                  </div>
                  <span className="text-sm text-orange-500 font-medium">总热点</span>
                </div>
                <p className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#F97316] to-[#F59E0B]">
                  {stats.total}
                </p>
              </div>
            </div>

            {/* 今日新增 */}
            <div className="bg-white border border-orange-100 rounded-2xl p-6 hover:shadow-xl hover:shadow-orange-200/40 transition-all duration-300 relative overflow-hidden group cursor-pointer">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-50 to-amber-50/0 group-hover:from-amber-100 group-hover:to-amber-50/0 transition-all duration-300"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-gradient-to-br from-amber-100 to-amber-50 rounded-xl">
                    <Zap className="text-[#F59E0B]" size={22} />
                  </div>
                  <span className="text-sm text-orange-500 font-medium">今日新增</span>
                </div>
                <p className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#F59E0B] to-[#F97316]">
                  {stats.total}
                </p>
              </div>
            </div>

            {/* 紧急热点 */}
            <div className="bg-white border border-orange-100 rounded-2xl p-6 hover:shadow-xl hover:shadow-orange-200/40 transition-all duration-300 relative overflow-hidden group cursor-pointer">
              <div className="absolute inset-0 bg-gradient-to-r from-red-50 to-red-50/0 group-hover:from-red-100 group-hover:to-red-50/0 transition-all duration-300"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-gradient-to-br from-red-100 to-red-50 rounded-xl">
                    <AlertTriangle className="text-[#EF4444]" size={22} />
                  </div>
                  <span className="text-sm text-orange-500 font-medium">紧急热点</span>
                </div>
                <p className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#EF4444] to-[#F97316]">
                  {stats.urgent}
                </p>
              </div>
            </div>

            {/* 监控词 */}
            <div className="bg-white border border-orange-100 rounded-2xl p-6 hover:shadow-xl hover:shadow-orange-200/40 transition-all duration-300 relative overflow-hidden group cursor-pointer" onClick={() => setViewMode('keywords')}>
              <div className="absolute inset-0 bg-gradient-to-r from-orange-50 to-orange-50/0 group-hover:from-orange-100 group-hover:to-orange-50/0 transition-all duration-300"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-gradient-to-br from-orange-100 to-orange-50 rounded-xl">
                    <BookOpen className="text-[#F97316]" size={22} />
                  </div>
                  <span className="text-sm text-orange-500 font-medium">监控词</span>
                </div>
                <p className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#F97316] to-[#F59E0B]">
                  {stats.activeKeywords}
                </p>
              </div>
            </div>
          </div>

          {/* 实时热点流 */}
          <div className="bg-white border border-orange-100 rounded-2xl shadow-xl shadow-orange-200/40">
              {/* 头部区域 */}
              <div className="px-6 py-4 border-b border-orange-100">
                {/* 标题和工具 */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-[#F97316] to-[#F59E0B]">
                    实时热点流
                  </h3>
                  <div className="flex items-center gap-3">
                    {/* 视图切换 */}
                    <div className="flex bg-orange-50 rounded-lg p-0.5">
                      <button
                        onClick={() => setHotspotViewMode('list')}
                        className={`px-3 py-1.5 rounded-md text-sm transition-all duration-200 ${hotspotViewMode === 'list' ? 'bg-white text-[#F97316] shadow-sm' : 'text-orange-400 hover:text-[#F97316]'}`}
                      >
                        <List size={16} />
                      </button>
                      <button
                        onClick={() => setHotspotViewMode('card')}
                        className={`px-3 py-1.5 rounded-md text-sm transition-all duration-200 ${hotspotViewMode === 'card' ? 'bg-white text-[#F97316] shadow-sm' : 'text-orange-400 hover:text-[#F97316]'}`}
                      >
                        <LayoutGrid size={16} />
                      </button>
                    </div>

                    {/* 重置按钮 */}
                    <button
                      onClick={handleReset}
                      className="flex items-center gap-1 text-sm text-orange-400 hover:text-orange-600 transition-all duration-200"
                      title="重置热点流"
                    >
                      <RotateCcw size={16} />
                      <span className="hidden sm:inline">重置</span>
                    </button>
                  </div>
                </div>

              {/* 排序栏 */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <ArrowUpDown size={16} className="text-[#F97316]" />
                  <span className="text-sm font-medium text-orange-600">排序:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'crawlTime', label: '抓取时间' },
                    { value: 'publishTime', label: '发布时间' },
                    { value: 'importance', label: '重要程度' },
                    { value: 'relevance', label: '相关性' },
                    { value: 'heat', label: '热度' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSort(option.value as SortOption)}
                      className={`px-4 py-2 rounded-lg text-sm transition-all duration-200 ${
                        sort === option.value
                          ? 'bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-white shadow-lg shadow-orange-300/40'
                          : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 筛选按钮 */}
              <div className="mb-4">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 ${
                    showFilters 
                      ? 'bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-white shadow-xl shadow-orange-300/40' 
                      : 'bg-orange-50 text-orange-700 hover:bg-gradient-to-r hover:from-[#F97316] hover:to-[#F59E0B] hover:text-white hover:shadow-xl hover:shadow-orange-300/40'
                  }`}
                >
                  <Filter size={18} />
                  <span className="text-sm font-medium">筛选</span>
                  <ChevronDown size={16} className={`transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} />
                </button>
              </div>
              
              {/* 筛选面板 */}
              {showFilters && (
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-6 border border-orange-200 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    {/* 来源筛选 */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-orange-700">
                        <div className="w-5 h-5 bg-blue-100 rounded-lg flex items-center justify-center">
                          <span className="text-xs">🌐</span>
                        </div>
                        来源
                      </label>
                      <CustomSelect
                        value={filterSource}
                        onChange={(value) => setFilterSource(value as FilterSource)}
                        options={[
                          { value: 'all', label: '全部来源' },
                          { value: 'twitter', label: 'Twitter' },
                          { value: 'bing', label: 'Bing' },
                          { value: 'google', label: 'Google' },
                          { value: 'duckduckgo', label: 'DuckDuckGo' },
                          { value: 'sogou', label: '搜狗' },
                          { value: 'bilibili', label: 'B站' },
                          { value: 'weibo', label: '微博' },
                        ]}
                      />
                    </div>

                    {/* 重要程度筛选 */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-orange-700">
                        <div className="w-5 h-5 bg-red-100 rounded-lg flex items-center justify-center">
                          <span className="text-xs">⚠️</span>
                        </div>
                        重要程度
                      </label>
                      <CustomSelect
                        value={filterImportance}
                        onChange={(value) => setFilterImportance(value as FilterImportance)}
                        options={[
                          { value: 'all', label: '全部级别' },
                          { value: 'urgent', label: '紧急' },
                          { value: 'high', label: '高' },
                          { value: 'medium', label: '中' },
                          { value: 'low', label: '低' },
                        ]}
                      />
                    </div>

                    {/* 关键词筛选 */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-orange-700">
                        <div className="w-5 h-5 bg-orange-100 rounded-lg flex items-center justify-center">
                          <BookOpen size={14} className="text-orange-600" />
                        </div>
                        关键词
                      </label>
                      <CustomSelect
                        value={filterKeywordId}
                        onChange={(value) => setFilterKeywordId(value === 'all' ? 'all' : Number(value))}
                        options={[
                          { value: 'all', label: '全部关键词' },
                          ...safeKeywords.map((keyword) => ({
                            value: keyword.id,
                            label: keyword.keyword,
                          })),
                        ]}
                      />
                    </div>

                    {/* 发布时间筛选 */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-orange-700">
                        <div className="w-5 h-5 bg-green-100 rounded-lg flex items-center justify-center">
                          <Clock size={14} className="text-green-600" />
                        </div>
                        发布时间
                      </label>
                      <CustomSelect
                        value={filterPublishTime}
                        onChange={(value) => setFilterPublishTime(value as FilterPublishTime)}
                        options={[
                          { value: 'all', label: '全部时间' },
                          { value: 'today', label: '今天' },
                          { value: 'week', label: '本周' },
                          { value: 'month', label: '本月' },
                        ]}
                      />
                    </div>

                    {/* 真实性筛选 */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm font-medium text-orange-700">
                        <div className="w-5 h-5 bg-purple-100 rounded-lg flex items-center justify-center">
                          <ShieldCheck size={14} className="text-purple-600" />
                        </div>
                        真实性
                      </label>
                      <CustomSelect
                        value={filterAuthenticity}
                        onChange={(value) => setFilterAuthenticity(value as FilterAuthenticity)}
                        options={[
                          { value: 'all', label: '全部' },
                          { value: 'trusted', label: '可信' },
                          { value: 'doubtful', label: '存疑' },
                        ]}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* 实时热点流内容区域 */}
            <div>
              {loading ? (
                <div className="p-8 text-center text-orange-400">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F97316] mx-auto mb-4" />
                  <p>加载中...</p>
                </div>
              ) : filteredHotspots.length === 0 ? (
                <div className="p-8 text-center text-orange-400">
                  <p>暂无匹配的热点数据</p>
                  <p className="text-sm mt-1 text-orange-300">尝试调整筛选条件</p>
                </div>
              ) : hotspotViewMode === 'list' ? (
                <div className="divide-y divide-orange-50">
                  {filteredHotspots.map((hotspot) => (
                    <div key={hotspot.id} className="p-5 hover:bg-orange-50 transition-colors duration-200 relative group cursor-pointer">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={`px-3 py-1 text-xs font-medium rounded-full ${importanceColor(hotspot.importanceLevel)}`}>
                              {hotspot.importanceLevel.toUpperCase()}
                            </span>
                            <span className={`px-2 py-0.5 text-xs rounded-full border ${sourceColors[hotspot.source] || 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                              {hotspot.source.toUpperCase()}
                            </span>
                            {/* 关键词标签 */}
                            {hotspot.keyword && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-full border border-orange-200">
                                📚 {hotspot.keyword.keyword}
                              </span>
                            )}
                            {/* 真实性标签 */}
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${
                              hotspot.credibilityScore >= 50 
                                ? 'bg-green-100 text-green-700 border-green-200' 
                                : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                            }`}>
                              {hotspot.credibilityScore >= 50 ? <ShieldCheck size={12} className="inline mr-0.5" /> : <ShieldAlert size={12} className="inline mr-0.5" />}
                              {hotspot.credibilityScore >= 50 ? '可信' : '存疑'}
                            </span>
                            {hotspot.author && (
                              <span className="text-xs text-gray-500">
                                by {hotspot.author}
                              </span>
                            )}
                          </div>
                          <h4 className="font-medium text-[#78350F] truncate group-hover:text-[#F97316] transition-colors duration-200">
                            {hotspot.title}
                          </h4>
                          <p className="text-sm text-orange-500 mt-2 line-clamp-3"><span className="font-medium text-[#F97316]">AI摘要：</span>{hotspot.summary}</p>
                          <div className="flex items-center gap-4 mt-3 text-xs text-orange-400 flex-wrap">
                          <span className="group-hover:text-[#F97316] transition-colors duration-200 flex items-center gap-1">
                            🎯 相关性: {hotspot.relevanceScore}%
                          </span>
                          {(hotspot.heatScore !== undefined && hotspot.heatScore !== null) && (
                            <span className="group-hover:text-red-500 transition-colors duration-200 flex items-center gap-1">
                              🔥 热度: {hotspot.heatScore}
                            </span>
                          )}
                          {(hotspot.viewCount !== undefined && hotspot.viewCount !== null && hotspot.viewCount > 0) && (
                            <span className="flex items-center gap-1">
                              👁️{formatNumber(hotspot.viewCount)}
                            </span>
                          )}
                          {(hotspot.commentCount !== undefined && hotspot.commentCount !== null && hotspot.commentCount > 0) && (
                            <span className="flex items-center gap-1">
                              💬{formatNumber(hotspot.commentCount)}
                            </span>
                          )}
                          {(hotspot.likeCount !== undefined && hotspot.likeCount !== null && hotspot.likeCount > 0) && (
                            <span className="flex items-center gap-1">
                              ❤️{formatNumber(hotspot.likeCount)}
                            </span>
                          )}
                          {hotspot.publishTime && (
                            <span className="flex items-center gap-1">
                              📅 发布时间: {formatRelativeTime(hotspot.publishTime)}
                            </span>
                          )}
                          {hotspot.crawlTime && (
                            <span className="flex items-center gap-1">
                              🕐 抓取时间: {formatRelativeTime(hotspot.crawlTime)}
                            </span>
                          )}
                        </div>
                        </div>
                        <a
                          href={hotspot.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-[#F97316] transition-all duration-300 group-hover:scale-110 transform transition-transform"
                        >
                          <ExternalLink size={16} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredHotspots.map((hotspot) => (
                      <div
                        key={hotspot.id}
                        className="bg-white border border-orange-100 rounded-xl p-4 hover:shadow-xl hover:shadow-orange-100/30 transition-all duration-300 relative group cursor-pointer"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-50 to-orange-50/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
                        <div className="flex items-start justify-between gap-2 mb-3 relative z-10 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${importanceColor(hotspot.importanceLevel)}`}>
                              {hotspot.importanceLevel.toUpperCase()}
                            </span>
                            <span className={`px-2 py-0.5 text-xs rounded-full border ${sourceColors[hotspot.source] || 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                              {hotspot.source.toUpperCase()}
                            </span>
                            {/* 关键词标签 */}
                            {hotspot.keyword && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-full border border-orange-200">
                                📚 {hotspot.keyword.keyword}
                              </span>
                            )}
                            {/* 真实性标签 */}
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${
                              hotspot.credibilityScore >= 50 
                                ? 'bg-green-100 text-green-700 border-green-200' 
                                : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                            }`}>
                              {hotspot.credibilityScore >= 50 ? <ShieldCheck size={10} className="inline mr-0.5" /> : <ShieldAlert size={10} className="inline mr-0.5" />}
                              {hotspot.credibilityScore >= 50 ? '可信' : '存疑'}
                            </span>
                            {hotspot.author && (
                              <span className="text-xs text-gray-500">
                                by {hotspot.author}
                              </span>
                            )}
                          </div>
                          <a
                            href={hotspot.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-[#F97316] transition-all duration-300 group-hover:scale-110 transform transition-transform"
                          >
                            <ExternalLink size={16} />
                          </a>
                        </div>

                        <h3 className="font-medium text-[#78350F] mb-2 line-clamp-2 group-hover:text-[#F97316] transition-colors duration-300 relative z-10">
                          {hotspot.title}
                        </h3>
                        <p className="text-sm text-orange-500 mb-3 line-clamp-3 relative z-10">
                          <span className="font-medium text-[#F97316]">AI摘要：</span>{hotspot.summary}
                        </p>

                        <div className="flex items-center gap-4 text-xs text-orange-400 mb-3 relative z-10 flex-wrap">
                          <span className="group-hover:text-[#F97316] transition-colors duration-300 flex items-center gap-1">
                            🎯 相关性: {hotspot.relevanceScore}%
                          </span>
                          {(hotspot.heatScore !== undefined && hotspot.heatScore !== null) && (
                            <span className="group-hover:text-red-500 transition-colors duration-300 flex items-center gap-1">
                              🔥 热度: {hotspot.heatScore}
                            </span>
                          )}
                          {(hotspot.viewCount !== undefined && hotspot.viewCount !== null && hotspot.viewCount > 0) && (
                            <span className="flex items-center gap-1">
                              👁{formatNumber(hotspot.viewCount)}
                            </span>
                          )}
                          {(hotspot.commentCount !== undefined && hotspot.commentCount !== null && hotspot.commentCount > 0) && (
                            <span className="flex items-center gap-1">
                              💬{formatNumber(hotspot.commentCount)}
                            </span>
                          )}
                          {(hotspot.likeCount !== undefined && hotspot.likeCount !== null && hotspot.likeCount > 0) && (
                            <span className="flex items-center gap-1">
                              ❤️{formatNumber(hotspot.likeCount)}
                            </span>
                          )}
                          {hotspot.publishTime && (
                            <span className="flex items-center gap-1">
                              📅 发布时间: {formatRelativeTime(hotspot.publishTime)}
                            </span>
                          )}
                          {hotspot.crawlTime && (
                            <span className="flex items-center gap-1">
                              🕐 抓取时间: {formatRelativeTime(hotspot.crawlTime)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
      
      {/* 搜索结果区域 - 仅在搜索模式时显示 */}
      {showSearchResults && (
        <div className="bg-white border border-orange-100 rounded-2xl shadow-xl shadow-orange-200/40">
          <div className="px-6 py-4 border-b border-orange-100">
            <h3 className="text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-[#F97316] to-[#F59E0B] mb-4">
              全网搜索
            </h3>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#F97316]" size={18} />
                <input
                  type="text"
                  placeholder="输入关键词进行全网搜索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                  className="w-full pl-10 pr-4 py-3 bg-orange-50 border border-orange-200 rounded-xl text-[#78350F] placeholder-orange-300 focus:outline-none focus:ring-2 focus:ring-[#F97316] transition-all duration-200"
                />
              </div>
              <button
                onClick={() => handleSearch()}
                disabled={isSearching || !searchQuery.trim()}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-white rounded-xl hover:from-[#F59E0B] hover:to-[#F97316] transition-all duration-200 shadow-xl shadow-orange-300/40 hover:shadow-orange-400/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSearching ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <Search size={18} />
                )}
                <span>{isSearching ? '搜索中...' : '搜索'}</span>
              </button>
            </div>
          </div>
          <div className="px-6 py-4">
            {isSearching ? (
              <div className="p-8 text-center text-orange-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F97316] mx-auto mb-4" />
                <p>正在全网搜索中...</p>
                <p className="text-sm mt-1 text-orange-300">这可能需要几秒钟</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-8 text-center text-orange-400">
                <Search size={48} className="mx-auto mb-4 text-orange-300" />
                <p>{searchQuery ? '未找到相关搜索结果' : '请输入关键词开始搜索'}</p>
                {searchQuery && <p className="text-sm mt-1 text-orange-300">尝试使用其他关键词</p>}
              </div>
            ) : (
              <div className="divide-y divide-orange-50">
                {searchResults.map((result, index) => (
                  <div key={index} className="p-5 hover:bg-orange-50 transition-colors duration-200 relative group cursor-pointer">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={`px-3 py-1 text-xs font-medium rounded-full ${importanceColor(result.importanceLevel)}`}>
                            {result.importanceLevel.toUpperCase()}
                          </span>
                          <span className={`px-2 py-0.5 text-xs rounded-full border ${sourceColors[result.source] || 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                            {result.source.toUpperCase()}
                          </span>
                          {/* 真实性标签 */}
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${
                            result.credibilityScore >= 50 
                              ? 'bg-green-100 text-green-700 border-green-200' 
                              : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                          }`}>
                            {result.credibilityScore >= 50 ? <ShieldCheck size={12} className="inline mr-0.5" /> : <ShieldAlert size={12} className="inline mr-0.5" />}
                            {result.credibilityScore >= 50 ? '可信' : '存疑'}
                          </span>
                          {result.author && (
                            <span className="text-xs text-gray-500">
                              by {result.author}
                            </span>
                          )}
                        </div>
                        <h4 className="font-medium text-[#78350F] truncate group-hover:text-[#F97316] transition-colors duration-200">
                          {result.title}
                        </h4>
                        <p className="text-sm text-orange-500 mt-2 line-clamp-2"><span className="font-medium text-[#F97316]">AI摘要：</span>{result.summary}</p>
                        <div className="flex items-center gap-4 mt-3 text-xs text-orange-400 flex-wrap">
                          <span className="group-hover:text-[#F97316] transition-colors duration-200 flex items-center gap-1">
                            🎯 相关性: {result.relevanceScore}%
                          </span>
                          {(result.heatScore !== undefined && result.heatScore !== null) && (
                            <span className="group-hover:text-red-500 transition-colors duration-200 flex items-center gap-1">
                              🔥 热度: {result.heatScore}
                            </span>
                          )}
                          {formatNumber(result.viewCount) && (
                            <span className="flex items-center gap-1">
                              👁{formatNumber(result.viewCount)}
                            </span>
                          )}
                          {formatNumber(result.commentCount) && (
                            <span className="flex items-center gap-1">
                              💬{formatNumber(result.commentCount)}
                            </span>
                          )}
                          {formatNumber(result.likeCount) && (
                            <span className="flex items-center gap-1">
                              ❤️{formatNumber(result.likeCount)}
                            </span>
                          )}
                          {result.publishTime && (
                            <span className="flex items-center gap-1">
                              📅 发布时间: {formatRelativeTime(result.publishTime)}
                            </span>
                          )}
                        </div>
                      </div>
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-orange-300 hover:text-[#F97316] transition-colors duration-200 group-hover:scale-110 transform transition-transform"
                      >
                        <ExternalLink size={18} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === 'keywords' && (
        <div className="bg-white border border-orange-100 rounded-2xl shadow-xl shadow-orange-200/40">
          <div className="px-6 py-4 border-b border-orange-100">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#F97316]" size={18} />
                <input
                  type="text"
                  placeholder="搜索关键词..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-orange-50 border border-orange-200 rounded-xl text-[#78350F] placeholder-orange-300 focus:outline-none focus:ring-2 focus:ring-[#F97316] transition-all duration-200"
                />
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-white rounded-xl hover:from-[#F59E0B] hover:to-[#F97316] transition-all duration-200 shadow-xl shadow-orange-300/40 hover:shadow-orange-400/50"
              >
                <Plus size={18} />
                添加关键词
              </button>
            </div>
          </div>

          <div className="divide-y divide-orange-50">
            {filteredKeywords.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-orange-400">暂无关键词</p>
              </div>
            ) : (
              filteredKeywords.map((keyword) => (
                <div key={keyword.id} className={`px-6 py-4 transition-all duration-300 relative group cursor-pointer ${
                  keyword.isActive ? 'bg-gradient-to-r from-orange-50 to-amber-50 border-l-4 border-[#F97316]' : 'hover:bg-orange-50'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={(e) => handleToggleActive(e, keyword)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 ${
                          keyword.isActive 
                            ? 'bg-gradient-to-r from-[#F97316] to-[#F59E0B] shadow-sm shadow-orange-300/30' 
                            : 'bg-gray-200 hover:bg-gray-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-300 ease-in-out ${
                            keyword.isActive ? 'translate-x-5' : ''
                          }`}
                        />
                      </button>

                      <div className="flex flex-col gap-1">
                        {editingId === keyword.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg text-[#78350F] focus:outline-none focus:ring-2 focus:ring-[#F97316] transition-all duration-200"
                              autoFocus
                            />
                            <button
                              onClick={(e) => handleSaveEdit(e)}
                              className="p-1 text-[#F97316] hover:text-[#F59E0B] transition-all duration-200"
                            >
                              <Check size={18} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                              className="p-1 text-orange-300 hover:text-orange-400 transition-all duration-200"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        ) : (
                          <span className={`font-semibold ${
                            keyword.isActive ? 'text-[#78350F] group-hover:text-[#F97316] transition-colors duration-200' : 'text-orange-300'
                          }`}>
                            {keyword.keyword}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSearch(keyword.keyword);
                        }}
                        className={`p-2 rounded-lg transition-all duration-200 group-hover:scale-110 transform transition-transform ${
                          keyword.isActive ? 'text-orange-500 hover:bg-orange-200 hover:text-[#F97316]' : 'text-orange-300 hover:bg-orange-100 hover:text-orange-500'
                        }`}
                        title="全网搜索"
                      >
                        <Search size={16} />
                      </button>
                      <button
                        onClick={(e) => handleStartEdit(e, keyword)}
                        className={`p-2 rounded-lg transition-all duration-200 group-hover:scale-110 transform transition-transform ${
                          keyword.isActive ? 'text-orange-500 hover:bg-orange-200 hover:text-[#F97316]' : 'text-orange-300 hover:bg-orange-100 hover:text-orange-500'
                        }`}
                        title="编辑"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, keyword.id)}
                        className={`p-2 rounded-lg transition-all duration-200 group-hover:scale-110 transform transition-transform ${
                          keyword.isActive ? 'text-orange-500 hover:bg-red-100 hover:text-red-500' : 'text-orange-300 hover:bg-orange-100 hover:text-red-500'
                        }`}
                        title="删除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-orange-400">
                    创建于: {new Date(keyword.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white border border-orange-100 rounded-2xl shadow-2xl shadow-orange-300/40 w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-orange-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-[#F97316] to-[#F59E0B]">
                添加关键词
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-orange-300 hover:text-orange-400 transition-all duration-200"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <input
                type="text"
                placeholder="输入关键词..."
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                className="w-full px-4 py-2.5 bg-orange-50 border border-orange-200 rounded-xl text-[#78350F] placeholder-orange-300 focus:outline-none focus:ring-2 focus:ring-[#F97316] transition-all duration-200"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
              />
            </div>
            <div className="px-6 py-4 border-t border-orange-100 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2.5 border border-orange-200 text-orange-500 rounded-xl hover:bg-orange-50 transition-all duration-200"
              >
                取消
              </button>
              <button
                onClick={handleAddKeyword}
                className="px-4 py-2.5 bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-white rounded-xl hover:from-[#F59E0B] hover:to-[#F97316] transition-all duration-200 shadow-xl shadow-orange-300/40 hover:shadow-orange-400/50"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white border border-orange-100 rounded-2xl shadow-2xl shadow-orange-300/40 w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-orange-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-[#EF4444] to-[#F97316]">
                确认删除
              </h3>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingId(null);
                }}
                className="text-orange-300 hover:text-orange-400 transition-all duration-200"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-50 rounded-full">
                  <AlertTriangle className="text-red-500" size={24} />
                </div>
                <div>
                  <p className="text-[#78350F] font-medium mb-1">确定要删除这个关键词吗？</p>
                  <p className="text-sm text-orange-500">此操作不可撤销，删除后相关的热点数据将不再受该关键词监控。</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-orange-100 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingId(null);
                }}
                className="px-4 py-2.5 border border-orange-200 text-orange-500 rounded-xl hover:bg-orange-50 transition-all duration-200"
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2.5 bg-gradient-to-r from-[#EF4444] to-[#F97316] text-white rounded-xl hover:from-[#F97316] hover:to-[#EF4444] transition-all duration-200 shadow-xl shadow-red-300/40 hover:shadow-red-400/50"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
