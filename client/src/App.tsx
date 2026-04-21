import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useEffect, useState, createContext, useContext, useRef } from 'react';
import { socketService } from './services/socket';
import { hotspotsApi, keywordsApi, systemApi, notificationsApi } from './services/api';
import { Hotspot, Keyword, Notification } from './types';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import { Activity, Settings as SettingsIcon, RefreshCw, Bell } from 'lucide-react';

// 创建刷新上下文
const RefreshContext = createContext<{
  hotspots: Hotspot[];
  keywords: Keyword[];
  refreshing: boolean;
  refresh: () => Promise<void>;
  cancelRefresh: () => void;
  refreshKeywords: () => Promise<void>;
  resetHotspots: () => void;
}>({
  hotspots: [],
  keywords: [],
  refreshing: false,
  refresh: async () => {},
  cancelRefresh: () => {},
  refreshKeywords: async () => {},
  resetHotspots: () => {},
});

// 自定义Hook
export const useRefresh = () => useContext(RefreshContext);

function App() {
  const location = useLocation();
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const isMounted = useRef(true);
  const refreshAbortController = useRef<AbortController | null>(null);
  const currentTaskId = useRef<string | null>(null);

  useEffect(() => {
    socketService.connect();
    
    // 监听新热点
    const handleNewHotspot = (newHotspot: Hotspot) => {
      if (isMounted.current) {
        setHotspots(prev => {
          // 避免重复添加
          if (prev.find(h => h.id === newHotspot.id)) return prev;
          return [newHotspot, ...prev];
        });
      }
    };

    // 监听采集完成
    const handleHotspotComplete = () => {
      console.log('📡 收到采集完成事件');
      // 重置状态
      setRefreshing(false);
      refreshAbortController.current = null;
      currentTaskId.current = null;
    };
    
    // 监听采集失败
    const handleHotspotError = () => {
      console.log('📡 收到采集失败事件');
      // 重置状态
      setRefreshing(false);
      refreshAbortController.current = null;
      currentTaskId.current = null;
    };

    socketService.on('hotspot', handleNewHotspot);
    socketService.on('hotspot-complete', handleHotspotComplete);
    socketService.on('hotspot-error', handleHotspotError);

    return () => {
      isMounted.current = false;
      socketService.off('hotspot', handleNewHotspot);
      socketService.off('hotspot-complete', handleHotspotComplete);
      socketService.off('hotspot-error', handleHotspotError);
      socketService.disconnect();
    };
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [hotspotsResponse, keywordsResponse, notificationsResponse] = await Promise.all([
        hotspotsApi.getAll({ limit: 10, sort: 'crawlTime' }),
        keywordsApi.getAll(),
        notificationsApi.getAll(),
      ]);
      
      // 服务器返回的是 { data: [...], pagination: {...} } 格式
      const hotspotsData = Array.isArray(hotspotsResponse) ? hotspotsResponse : (hotspotsResponse.data || []);
      const keywordsData = Array.isArray(keywordsResponse) ? keywordsResponse : (keywordsResponse.data || []);
      const notificationsData = Array.isArray(notificationsResponse) ? notificationsResponse : (notificationsResponse.data || []);
      
      console.log('加载热点数据:', hotspotsData);
      console.log('加载关键词数据:', keywordsData);
      console.log('加载通知数据:', notificationsData);
      
      setHotspots(hotspotsData);
      setKeywords(keywordsData);
      setNotifications(notificationsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      console.log('正在标记全部通知为已读...');
      const result = await notificationsApi.markAllAsRead();
      console.log('标记全部已读成功:', result);
      // 更新本地状态
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      alert('标记全部已读失败，请检查后端服务是否正常运行');
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const resetHotspots = () => {
    console.log('重置热点流');
    setHotspots([]);
  };

  const refreshKeywords = async () => {
    try {
      const keywordsResponse = await keywordsApi.getAll();
      const keywordsData = Array.isArray(keywordsResponse) ? keywordsResponse : (keywordsResponse.data || []);
      console.log('刷新关键词数据:', keywordsData);
      setKeywords(keywordsData);
    } catch (error) {
      console.error('Failed to refresh keywords:', error);
    }
  };

  const cancelRefresh = () => {
    console.log('⏹️ 用户点击取消刷新');
    
    const taskIdToCancel = currentTaskId.current;
    
    // 1. 立即设置状态为 false
    setRefreshing(false);
    
    // 2. 取消请求
    if (refreshAbortController.current) {
      refreshAbortController.current.abort();
    }
    
    // 3. 清理 refs
    refreshAbortController.current = null;
    currentTaskId.current = null;
    
    // 4. 取消后端任务
    if (taskIdToCancel) {
      systemApi.cancelCrawl(taskIdToCancel).catch(e => {
        console.error('取消后端任务失败:', e);
      });
    }
  };

  const handleRefresh = async () => {
    console.log('🔄 点击刷新，当前状态:', refreshing);
    
    if (refreshing) {
      cancelRefresh();
      return;
    }

    // 第一步：立即设置状态为 true
    console.log('1️⃣ 设置 refreshing = true');
    setRefreshing(true);
    
    const abortController = new AbortController();
    refreshAbortController.current = abortController;
    
    let taskId: string | null = null;
    
    try {
      // 第二步：触发热点采集
      console.log('2️⃣ 触发热点采集...');
      try {
        const response = await systemApi.triggerCrawl({ signal: abortController.signal });
        if (response && response.taskId) {
          taskId = response.taskId;
          currentTaskId.current = taskId;
          console.log('   ✅ 任务已启动，ID:', taskId);
        }
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') {
          console.log('   ⏹️ 采集已取消');
          return;
        }
        console.log('   ⚠️ 跳过采集:', e);
      }
      
      if (abortController.signal.aborted) {
        console.log('3️⃣ 检测到已取消');
        return;
      }
      
      // 第三步：获取数据
      console.log('3️⃣ 获取数据...');
      const [hotspotsResponse, keywordsResponse] = await Promise.all([
        hotspotsApi.getAll({ limit: 10, sort: 'crawlTime' }, { signal: abortController.signal }),
        keywordsApi.getAll({ signal: abortController.signal }),
      ]);
      
      if (abortController.signal.aborted) {
        console.log('4️⃣ 检测到已取消');
        return;
      }
      
      // 第四步：更新数据
      console.log('4️⃣ 更新数据...');
      const hotspotsData = Array.isArray(hotspotsResponse) ? hotspotsResponse : (hotspotsResponse.data || []);
      const keywordsData = Array.isArray(keywordsResponse) ? keywordsResponse : (keywordsResponse.data || []);
      
      setHotspots(hotspotsData);
      setKeywords(keywordsData);
      console.log('   ✅ 数据已更新');
      
      // 关键点：不重置 refreshing！保持显示"停止刷新"，等待用户点击停止
      console.log('   ✅ 数据更新完成，保持刷新状态');
      
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') {
        console.log('❌ 刷新已主动取消');
        return;
      }
      console.error('❌ 刷新失败:', error);
      // 出错时重置状态
      setRefreshing(false);
    }
    // 注意：移除了 finally 块，不再自动重置状态
  };

  const navItems = [
    { path: '/', label: '仪表盘', icon: Activity },
    { path: '/settings', label: '设置', icon: SettingsIcon },
  ];

  // 点击外部关闭通知面板
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showNotifications) {
        // 检查点击是否在通知容器外
        const notificationContainer = document.querySelector('.notification-container');
        if (notificationContainer && !notificationContainer.contains(target)) {
          setShowNotifications(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  return (
    <RefreshContext.Provider value={{ hotspots, keywords, refreshing, refresh: handleRefresh, cancelRefresh, refreshKeywords, resetHotspots }}>
      <div className="min-h-screen bg-[#FFF7ED] text-[#78350F] overflow-x-hidden" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {/* 导航栏 */}
        <header className="backdrop-blur-xl bg-white/90 border border-orange-100 rounded-2xl shadow-xl shadow-orange-200/40 mx-4 mt-4 relative z-40">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#F97316] to-[#F59E0B] rounded-xl flex items-center justify-center shadow-lg shadow-orange-300/50">
                    <Activity size={20} className="text-white" />
                  </div>
                  <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#F97316] to-[#F59E0B]">
                    Hotspot AI热点追踪
                  </h1>
                </div>
                <nav className="flex gap-2 items-center">
                  {/* 刷新按钮 - 靠左，在仪表盘左边 */}
                  {location.pathname === '/' && (
                    <button
                      onClick={handleRefresh}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 cursor-pointer active:scale-95 mr-8 ${
                        refreshing
                          ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-xl shadow-red-300/40 hover:from-red-600 hover:to-orange-600'
                          : 'bg-orange-50 text-orange-700 hover:bg-gradient-to-r hover:from-[#F97316] hover:to-[#F59E0B] hover:text-white hover:shadow-xl hover:shadow-orange-300/40'
                      }`}
                    >
                      <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                      <span className="hidden sm:inline">{refreshing ? '停止刷新' : '立即刷新'}</span>
                    </button>
                  )}

                  {/* 通知图标 */}
                  <div className="notification-container relative z-50">
                    <button
                      onClick={() => setShowNotifications(!showNotifications)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 cursor-pointer active:scale-95 h-[42px] ${
                        showNotifications 
                          ? 'bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-white shadow-xl shadow-orange-300/40' 
                          : 'bg-orange-50 text-orange-700 hover:bg-gradient-to-r hover:from-[#F97316] hover:to-[#F59E0B] hover:text-white hover:shadow-xl hover:shadow-orange-300/40'
                      }`}
                    >
                      <Bell size={18} />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                          {unreadCount}
                        </span>
                      )}
                    </button>

                    {/* 通知面板 */}
                    {showNotifications && (
                      <div className="absolute right-0 top-[54px] w-80 bg-white rounded-2xl shadow-2xl shadow-orange-200/40 border border-orange-100 z-[9999]">
                        <div className="p-4 border-b border-orange-100 flex items-center justify-between">
                          <h3 className="font-semibold bg-clip-text text-transparent bg-gradient-to-r from-[#F97316] to-[#F59E0B]">
                            热点通知
                          </h3>
                          {unreadCount > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkAllAsRead();
                              }}
                              className="text-xs text-orange-600 hover:text-orange-800 font-medium"
                            >
                              全部已读
                            </button>
                          )}
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                          {notifications.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">
                              <p>暂无通知</p>
                            </div>
                          ) : (
                            notifications.map((notification) => (
                              <div
                                key={notification.id}
                                className={`p-4 border-b border-orange-50 last:border-0 ${
                                  !notification.isRead ? 'bg-orange-50/50' : ''
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <h4 className={`font-medium ${!notification.isRead ? 'text-[#78350F]' : 'text-gray-600'}`}>
                                      {notification.title}
                                    </h4>
                                    <p className="text-sm text-gray-500 mt-1">
                                      {notification.content}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-2">
                                      {new Date(notification.createdAt).toLocaleString()}
                                    </p>
                                  </div>
                                  {!notification.isRead && (
                                    <div className="w-2 h-2 bg-[#F97316] rounded-full mt-2 flex-shrink-0" />
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 导航项 */}
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 relative overflow-hidden cursor-pointer ${
                          isActive
                            ? 'bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-white shadow-xl shadow-orange-300/40'
                            : 'text-orange-700 hover:bg-orange-50 hover:text-[#F97316]'
                        }`}
                      >
                        <Icon 
                          size={18} 
                        />
                        <span className="hidden sm:inline">{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 relative z-0">
          <div className="bg-white/95 border border-orange-100 rounded-3xl p-8 shadow-2xl shadow-orange-200/40 transition-all duration-300">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </div>
        </main>
      </div>
    </RefreshContext.Provider>
  );
}

export default App;
