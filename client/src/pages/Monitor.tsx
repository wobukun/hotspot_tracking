import { useState, useEffect } from 'react';
import { hotspotsApi } from '../services/api';
import { socketService } from '../services/socket';
import { Hotspot, SortOption, FilterSource, FilterImportance } from '../types';
import { ExternalLink, ChevronDown, ChevronUp, Filter, ArrowUpDown, RefreshCw, List, LayoutGrid } from 'lucide-react';

export default function Monitor() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortOption>('crawlTime');
  const [filterSource, setFilterSource] = useState<FilterSource>('all');
  const [filterImportance, setFilterImportance] = useState<FilterImportance>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  useEffect(() => {
    loadHotspots();

    socketService.on('hotspot', (newHotspot: Hotspot) => {
      setHotspots(prev => [newHotspot, ...prev]);
    });

    socketService.on('hotspot-complete', () => {
      console.log('收到hotspot-complete事件，重新加载热点');
      loadHotspots();
    });

    return () => {
      socketService.off('hotspot', () => {});
      socketService.off('hotspot-complete', () => {});
    };
  }, []);

  const loadHotspots = async () => {
    try {
      const response = await hotspotsApi.getAll({ limit: 50, sort, source: filterSource, importance: filterImportance });
      // 服务器返回的是 { data: [...], pagination: {...} } 格式
      const data = Array.isArray(response) ? response : (response.data || []);
      console.log('Monitor加载热点数据:', data);
      setHotspots(data);
    } catch (error) {
      console.error('Failed to load hotspots:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSortChange = (newSort: SortOption) => {
    setSort(newSort);
    loadHotspots();
  };

  const handleFilterChange = () => {
    loadHotspots();
  };

  const safeHotspots = Array.isArray(hotspots) ? hotspots : [];
  const filteredHotspots = safeHotspots;

  const importanceColor = (level: string) => {
    switch (level) {
      case 'urgent': return 'bg-red-100 text-red-700 border border-red-200';
      case 'high': return 'bg-blue-100 text-blue-700 border border-blue-200';
      case 'medium': return 'bg-purple-100 text-purple-700 border border-purple-200';
      case 'low': return 'bg-gray-100 text-gray-600 border border-gray-200';
      default: return 'bg-gray-100 text-gray-600 border border-gray-200';
    }
  };

  const sourceColors: Record<string, string> = {
    twitter: 'bg-blue-100 text-blue-700 border border-blue-200',
    bing: 'bg-green-100 text-green-700 border border-green-200',
    google: 'bg-red-100 text-red-700 border border-red-200',
    duckduckgo: 'bg-orange-100 text-orange-700 border border-orange-200',
    hackernews: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
    sogou: 'bg-blue-100 text-blue-700 border border-blue-200',
    bilibili: 'bg-pink-100 text-pink-700 border border-pink-200',
    weibo: 'bg-red-100 text-red-700 border border-red-200',
  };

  const formatNumber = (num: number | undefined | null): string => {
    if (num === undefined || num === null) return '-';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E40AF]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-['Fira_Sans']">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#1E40AF] to-[#3B82F6]">
          热点监控
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('card')}
            className={`p-2 rounded-lg transition-all duration-300 ${viewMode === 'card' ? 'bg-blue-100 text-[#1E40AF]' : 'text-gray-400 hover:bg-blue-50'}`}
          >
            <LayoutGrid size={18} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-all duration-300 ${viewMode === 'list' ? 'bg-blue-100 text-[#1E40AF]' : 'text-gray-400 hover:bg-blue-50'}`}
          >
            <List size={18} />
          </button>
          <button
            onClick={loadHotspots}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-100 to-white text-[#1E40AF] border border-blue-200 rounded-lg hover:from-white hover:to-blue-100 transition-all duration-300"
          >
            <RefreshCw size={18} />
            刷新
          </button>
        </div>
      </div>

      <div className="backdrop-blur-sm bg-white border border-blue-100 rounded-xl shadow-lg shadow-blue-100/30">
        <div className="px-6 py-4 border-b border-blue-100 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-[#1E40AF]" />
            <span className="text-sm text-gray-500 font-['Fira_Code']">筛选:</span>
          </div>

          <select
            value={filterSource}
            onChange={(e) => { setFilterSource(e.target.value as FilterSource); handleFilterChange(); }}
            className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E40AF] transition-all duration-300"
          >
            <option value="all">全部来源</option>
            <option value="twitter">Twitter</option>
            <option value="bing">Bing</option>
            <option value="google">Google</option>
            <option value="duckduckgo">DuckDuckGo</option>
            <option value="hackernews">HackerNews</option>
            <option value="sogou">搜狗</option>
            <option value="bilibili">B站</option>
            <option value="weibo">微博</option>
          </select>

          <select
            value={filterImportance}
            onChange={(e) => { setFilterImportance(e.target.value as FilterImportance); handleFilterChange(); }}
            className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E40AF] transition-all duration-300"
          >
            <option value="all">全部级别</option>
            <option value="urgent">紧急</option>
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
          </select>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <ArrowUpDown size={18} className="text-[#1E40AF]" />
            <span className="text-sm text-gray-500 font-['Fira_Code']">排序:</span>
            <select
              value={sort}
              onChange={(e) => handleSortChange(e.target.value as SortOption)}
              className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E40AF] transition-all duration-300"
            >
              <option value="crawlTime">抓取时间</option>
              <option value="publishTime">发布时间</option>
              <option value="importance">重要程度</option>
              <option value="relevance">相关性</option>
            </select>
          </div>
        </div>

        <div className="p-6">
          {filteredHotspots.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>暂无热点数据</p>
            </div>
          ) : viewMode === 'card' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredHotspots.map((hotspot) => (
                <div
                  key={hotspot.id}
                  className="backdrop-blur-sm bg-white border border-blue-100 rounded-xl p-4 hover:shadow-lg hover:shadow-blue-100/30 transition-all duration-300 relative group cursor-pointer"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-blue-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
                  <div className="flex items-start justify-between gap-2 mb-3 relative z-10 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${importanceColor(hotspot.importanceLevel)}`}>
                        {hotspot.importanceLevel.toUpperCase()}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded-full border ${sourceColors[hotspot.source] || 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                        {hotspot.source.toUpperCase()}
                      </span>
                      {(hotspot.viewCount !== undefined && hotspot.viewCount !== null) && (
                        <span className="text-xs text-blue-600 font-['Fira_Code']">
                          👁️ {formatNumber(hotspot.viewCount)}
                        </span>
                      )}
                      {(hotspot.commentCount !== undefined && hotspot.commentCount !== null) && (
                        <span className="text-xs text-green-600 font-['Fira_Code']">
                          💬 {formatNumber(hotspot.commentCount)}
                        </span>
                      )}
                      {(hotspot.likeCount !== undefined && hotspot.likeCount !== null) && (
                        <span className="text-xs text-red-400 font-['Fira_Code']">
                          ❤️ {formatNumber(hotspot.likeCount)}
                        </span>
                      )}
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
                      className="text-gray-400 hover:text-[#1E40AF] transition-all duration-300 group-hover:scale-110 transform transition-transform"
                    >
                      <ExternalLink size={16} />
                    </a>
                  </div>

                  <h3 className="font-medium text-[#1E3A8A] mb-2 line-clamp-2 group-hover:text-[#1E40AF] transition-colors duration-300 relative z-10">
                    {hotspot.title}
                  </h3>
                  <p className="text-sm text-gray-500 mb-3 line-clamp-3 relative z-10">
                    <span className="font-medium text-[#1E40AF]">AI摘要：</span>{hotspot.summary}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-3 relative z-10 flex-wrap">
                    <span className="group-hover:text-[#1E40AF] transition-colors duration-300 font-['Fira_Code']">
                      🎯 相关性: {hotspot.relevanceScore}%
                    </span>
                    <span className="group-hover:text-[#3B82F6] transition-colors duration-300 font-['Fira_Code']">
                      ✅ 可信度: {hotspot.credibilityScore}%
                    </span>
                    {(hotspot.heatScore !== undefined && hotspot.heatScore !== null) && (
                      <span className="group-hover:text-red-500 transition-colors duration-300 font-['Fira_Code']">
                        🔥 热度: {hotspot.heatScore}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => setExpandedId(expandedId === hotspot.id ? null : hotspot.id)}
                    className="w-full flex items-center justify-center gap-1 py-1.5 text-sm text-[#1E40AF] hover:bg-blue-50 rounded-lg transition-all duration-300 relative z-10"
                  >
                    {expandedId === hotspot.id ? (
                      <>
                        收起详情 <ChevronUp size={16} />
                      </>
                    ) : (
                      <>
                        查看详情 <ChevronDown size={16} />
                      </>
                    )}
                  </button>

                  {expandedId === hotspot.id && (
                    <div className="mt-3 pt-3 border-t border-blue-100 text-sm text-gray-500 relative z-10 space-y-2">
                      <p><strong className="text-[#1E40AF]">分析理由:</strong> {hotspot.analysisReason}</p>
                      {hotspot.publishTime && (
                        <p className="text-gray-400 text-xs font-['Fira_Code']">
                          📅 发布时间: {new Date(hotspot.publishTime).toLocaleString()}
                        </p>
                      )}
                      {hotspot.crawlTime && (
                        <p className="text-gray-400 text-xs font-['Fira_Code']">
                          🕐 抓取时间: {new Date(hotspot.crawlTime).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHotspots.map((hotspot) => (
                <div
                  key={hotspot.id}
                  className="backdrop-blur-sm bg-white border border-blue-100 rounded-xl p-4 hover:shadow-lg hover:shadow-blue-100/30 transition-all duration-300 relative group cursor-pointer"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-blue-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
                  <div className="flex items-start justify-between gap-4 relative z-10">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${importanceColor(hotspot.importanceLevel)}`}>
                          {hotspot.importanceLevel.toUpperCase()}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded-full border ${sourceColors[hotspot.source] || 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                          {hotspot.source.toUpperCase()}
                        </span>
                        {(hotspot.viewCount !== undefined && hotspot.viewCount !== null) && (
                          <span className="text-xs text-blue-600 font-['Fira_Code']">
                            👁️ {formatNumber(hotspot.viewCount)}
                          </span>
                        )}
                        {(hotspot.commentCount !== undefined && hotspot.commentCount !== null) && (
                          <span className="text-xs text-green-600 font-['Fira_Code']">
                            💬 {formatNumber(hotspot.commentCount)}
                          </span>
                        )}
                        {(hotspot.likeCount !== undefined && hotspot.likeCount !== null) && (
                          <span className="text-xs text-red-400 font-['Fira_Code']">
                            ❤️ {formatNumber(hotspot.likeCount)}
                          </span>
                        )}
                        {hotspot.author && (
                          <span className="text-xs text-gray-500">
                            by {hotspot.author}
                          </span>
                        )}
                      </div>
                      <h3 className="font-medium text-[#1E3A8A] mb-1 group-hover:text-[#1E40AF] transition-colors duration-300">
                        {hotspot.title}
                      </h3>
                      <p className="text-sm text-gray-500 mb-2"><span className="font-medium text-[#1E40AF]">AI摘要：</span>{hotspot.summary}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                        <span className="font-['Fira_Code']">🎯 相关性: {hotspot.relevanceScore}%</span>
                        <span className="font-['Fira_Code']">✅ 可信度: {hotspot.credibilityScore}%</span>
                        {(hotspot.heatScore !== undefined && hotspot.heatScore !== null) && (
                          <span className="font-['Fira_Code']">🔥 热度: {hotspot.heatScore}</span>
                        )}
                      </div>
                      {expandedId === hotspot.id && (
                        <div className="mt-2 pt-2 border-t border-blue-100 text-sm text-gray-500 space-y-1">
                          <p><strong className="text-[#1E40AF]">分析理由:</strong> {hotspot.analysisReason}</p>
                          {hotspot.publishTime && (
                            <p className="text-xs font-['Fira_Code'] text-gray-400">
                              📅 发布时间: {new Date(hotspot.publishTime).toLocaleString()}
                            </p>
                          )}
                          {hotspot.crawlTime && (
                            <p className="text-xs font-['Fira_Code'] text-gray-400">
                              🕐 抓取时间: {new Date(hotspot.crawlTime).toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setExpandedId(expandedId === hotspot.id ? null : hotspot.id)}
                        className="p-2 text-gray-400 hover:text-[#1E40AF] transition-all duration-300 group-hover:scale-110 transform transition-transform"
                      >
                        {expandedId === hotspot.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                      <a
                        href={hotspot.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-[#1E40AF] transition-all duration-300 group-hover:scale-110 transform transition-transform"
                      >
                        <ExternalLink size={18} />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
