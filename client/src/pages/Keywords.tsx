import { useState, useEffect } from 'react';
import { keywordsApi } from '../services/api';
import { Keyword } from '../types';
import { Plus, Search, ToggleLeft, ToggleRight, Trash2, Edit2, X, Check } from 'lucide-react';

export default function Keywords() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    loadKeywords();
  }, []);

  const loadKeywords = async () => {
    try {
      const data = await keywordsApi.getAll();
      setKeywords(data);
    } catch (error) {
      console.error('Failed to load keywords:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) return;
    try {
      await keywordsApi.create(newKeyword.trim());
      setNewKeyword('');
      setShowAddModal(false);
      loadKeywords();
    } catch (error) {
      console.error('Failed to add keyword:', error);
    }
  };

  const handleToggleActive = async (keyword: Keyword) => {
    try {
      await keywordsApi.update(keyword.id, { isActive: !keyword.isActive });
      loadKeywords();
    } catch (error) {
      console.error('Failed to toggle keyword:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个关键词吗？')) return;
    try {
      await keywordsApi.delete(id);
      loadKeywords();
    } catch (error) {
      console.error('Failed to delete keyword:', error);
    }
  };

  const handleStartEdit = (keyword: Keyword) => {
    setEditingId(keyword.id);
    setEditValue(keyword.keyword);
  };

  const handleSaveEdit = async () => {
    if (!editValue.trim() || !editingId) return;
    try {
      await keywordsApi.update(editingId, { keyword: editValue.trim() });
      setEditingId(null);
      setEditValue('');
      loadKeywords();
    } catch (error) {
      console.error('Failed to update keyword:', error);
    }
  };

  const filteredKeywords = keywords.filter(k =>
    k.keyword.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          关键词管理
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#1E40AF] to-[#3B82F6] text-white rounded-lg hover:from-[#3B82F6] hover:to-[#1E40AF] transition-all duration-300 shadow-lg shadow-blue-200 hover:shadow-blue-300"
        >
          <Plus size={18} />
          添加关键词
        </button>
      </div>

      <div className="backdrop-blur-sm bg-white border border-blue-100 rounded-xl shadow-lg shadow-blue-100/30">
        <div className="px-6 py-4 border-b border-blue-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1E40AF]" size={18} />
            <input
              type="text"
              placeholder="搜索关键词..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-[#1E3A8A] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] transition-all duration-300"
            />
          </div>
        </div>

        <div className="divide-y divide-blue-50">
          {filteredKeywords.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">暂无关键词</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-2 text-[#1E40AF] hover:text-[#3B82F6] transition-all duration-300"
              >
                添加第一个关键词
              </button>
            </div>
          ) : (
            filteredKeywords.map((keyword) => (
              <div key={keyword.id} className="px-6 py-4 hover:bg-blue-50 transition-colors duration-300 relative group cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-blue-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleToggleActive(keyword)}
                      className={`transition-colors duration-300 group-hover:scale-110 transform transition-transform ${
                        keyword.isActive ? 'text-[#1E40AF]' : 'text-gray-400'
                      }`}
                    >
                      {keyword.isActive ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                    </button>

                    {editingId === keyword.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="px-3 py-1 bg-blue-50 border border-blue-200 rounded-lg text-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E40AF] transition-all duration-300"
                          autoFocus
                        />
                        <button
                          onClick={handleSaveEdit}
                          className="p-1 text-[#1E40AF] hover:text-[#3B82F6] transition-all duration-300"
                        >
                          <Check size={18} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 text-gray-400 hover:text-gray-500 transition-all duration-300"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ) : (
                      <span className={`font-medium ${
                        keyword.isActive ? 'text-[#1E3A8A] group-hover:text-[#1E40AF] transition-colors duration-300' : 'text-gray-400'
                      }`}>
                        {keyword.keyword}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleStartEdit(keyword)}
                      className="p-2 text-gray-400 hover:text-[#1E40AF] transition-all duration-300 group-hover:scale-110 transform transition-transform"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(keyword.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-all duration-300 group-hover:scale-110 transform transition-transform"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="mt-2 text-xs text-gray-500 font-['Fira_Code']">
                  创建于: {new Date(keyword.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="backdrop-blur-md bg-white border border-blue-100 rounded-xl shadow-lg shadow-blue-100/30 w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-blue-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-[#1E40AF] to-[#3B82F6]">
                添加关键词
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-500 transition-all duration-300"
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
                className="w-full px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-[#1E3A8A] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1E40AF] transition-all duration-300"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
              />
            </div>
            <div className="px-6 py-4 border-t border-blue-100 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-blue-200 text-gray-500 rounded-lg hover:bg-blue-50 transition-all duration-300"
              >
                取消
              </button>
              <button
                onClick={handleAddKeyword}
                className="px-4 py-2 bg-gradient-to-r from-[#1E40AF] to-[#3B82F6] text-white rounded-lg hover:from-[#3B82F6] hover:to-[#1E40AF] transition-all duration-300 shadow-lg shadow-blue-200 hover:shadow-blue-300"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
