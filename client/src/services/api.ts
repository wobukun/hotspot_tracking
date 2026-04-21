const API_BASE_URL = 'http://localhost:3001/api';

export const api = {
  async get(endpoint: string, options?: { signal?: AbortSignal }) {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      signal: options?.signal,
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },

  async post(endpoint: string, data: any, options?: { signal?: AbortSignal }) {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: options?.signal,
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },

  async put(endpoint: string, data: any, options?: { signal?: AbortSignal }) {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: options?.signal,
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },

  async delete(endpoint: string, options?: { signal?: AbortSignal }) {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      signal: options?.signal,
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },
};

export const keywordsApi = {
  getAll: (options?: { signal?: AbortSignal }) => api.get('/keywords', options),
  create: (keyword: string, options?: { signal?: AbortSignal }) => api.post('/keywords', { keyword }, options),
  update: (id: number, data: any, options?: { signal?: AbortSignal }) => api.put(`/keywords/${id}`, data, options),
  delete: (id: number, options?: { signal?: AbortSignal }) => api.delete(`/keywords/${id}`, options),
};

export const hotspotsApi = {
  getAll: (params?: any, options?: { signal?: AbortSignal }) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/hotspots${query}`, options);
  },
  deleteAll: (options?: { signal?: AbortSignal }) => api.delete('/hotspots', options),
  search: (query: string, limit?: number, options?: { signal?: AbortSignal }) => 
    api.post('/hotspots/search', { query, limit }, options),
};

export const notificationsApi = {
  getAll: (options?: { signal?: AbortSignal }) => api.get('/notifications', options),
  markAsRead: (id: number, options?: { signal?: AbortSignal }) => api.put(`/notifications/${id}`, { isRead: true }, options),
  markAllAsRead: (options?: { signal?: AbortSignal }) => api.put('/notifications/mark-all-read', {}, options),
};

export const systemApi = {
  getConfig: (options?: { signal?: AbortSignal }) => api.get('/system/config', options),
  updateConfig: (config: any, options?: { signal?: AbortSignal }) => api.put('/system/config', config, options),
  getSystemStatus: (options?: { signal?: AbortSignal }) => api.get('/system/status', options),
  triggerCrawl: (options?: { signal?: AbortSignal }) => api.post('/system/crawl', {}, options),
  cancelCrawl: (taskId: string, options?: { signal?: AbortSignal }) => api.post(`/system/crawl/${taskId}/cancel`, {}, options),
};
