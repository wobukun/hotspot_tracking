import { useState, useEffect } from 'react';
import { systemApi } from '../services/api';
import { Save, Mail, CheckCircle } from 'lucide-react';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  const [emailEnabled, setEmailEnabled] = useState(true);
  const [emailTo, setEmailTo] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const config = await systemApi.getConfig();
      setEmailEnabled(config.emailEnabled);
      setEmailTo(config.emailTo || '');
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await systemApi.updateConfig({ emailEnabled, emailTo });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F97316]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#F97316] to-[#F59E0B]">
          系统设置
        </h2>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-white rounded-xl hover:from-[#F59E0B] hover:to-[#F97316] transition-all duration-300 shadow-lg shadow-orange-200/40 active:scale-95"
        >
          {saved ? <CheckCircle size={18} /> : <Save size={18} />}
          {saved ? '已保存' : '保存设置'}
        </button>
      </div>

      <div className="backdrop-blur-xl bg-white/95 border border-orange-100 rounded-3xl shadow-xl shadow-orange-200/40">
        <div className="px-6 py-4 border-b border-orange-100 flex items-center gap-3">
          <div className="p-2 bg-orange-50 rounded-xl border border-orange-200">
            <Mail className="text-[#F97316]" size={20} />
          </div>
          <div>
            <h3 className="font-semibold bg-clip-text text-transparent bg-gradient-to-r from-[#F97316] to-[#F59E0B]">
              邮件通知
            </h3>
            <p className="text-sm text-gray-500">配置热点邮件通知</p>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-orange-50 rounded-lg">
                <Mail className="text-[#F97316]" size={18} />
              </div>
              <div>
                <p className="font-medium text-[#78350F]">启用邮件通知</p>
                <p className="text-xs text-gray-500">高优先级热点发送邮件通知</p>
              </div>
            </div>
            <button
              onClick={() => setEmailEnabled(!emailEnabled)}
              className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
                emailEnabled ? 'bg-gradient-to-r from-[#F97316] to-[#F59E0B]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform duration-300 shadow-md ${
                  emailEnabled ? 'left-8' : 'left-1'
                }`}
              />
            </button>
          </div>

          <div className="border-t border-orange-100 pt-6">
            <label className="block text-sm font-medium text-gray-600 mb-2">
              接收邮箱
            </label>
            <input
              type="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="example@email.com"
              disabled={!emailEnabled}
              className="w-full px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl text-[#78350F] focus:outline-none focus:ring-2 focus:ring-[#F97316] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="mt-2 text-xs text-gray-400">
              设置接收热点通知的邮箱地址
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
