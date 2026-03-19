import { useState, useEffect } from 'react';
import { X, Building2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'react-toastify';

interface CreateCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompanyCreated: (companyName: string) => void;
  forceOpen?: boolean;
}

export function CreateCompanyModal({
  isOpen,
  onClose,
  onCompanyCreated,
  forceOpen = false,
}: CreateCompanyModalProps) {
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [recommendedCompanies, setRecommendedCompanies] = useState<string[]>([]);
  const [loadingRecommended, setLoadingRecommended] = useState(false);

  // 当弹窗打开时，获取推荐的公司列表
  useEffect(() => {
    if (isOpen) {
      setLoadingRecommended(true);
      api.getRecommendedCompanies()
        .then(data => {
          setRecommendedCompanies(data.companies);
        })
        .catch(() => {
          // 静默失败，不显示错误提示
          setRecommendedCompanies([]);
        })
        .finally(() => {
          setLoadingRecommended(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyName.trim()) {
      toast.error('公司名不能为空');
      return;
    }

    try {
      setLoading(true);
      await api.createCompany(companyName.trim());
      toast.success('公司创建成功');
      onCompanyCreated(companyName.trim());
      setCompanyName('');
      onClose();
    } catch (error) {
      // Failed to create company
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={forceOpen ? undefined : onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-soft-lg w-full max-w-md mx-4 p-6">
        {!forceOpen && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {forceOpen ? '欢迎来到 AI Company' : '新建公司'}
            </h2>
            <p className="text-sm text-slate-500">
              {forceOpen ? '请先创建一个公司开始使用' : '创建一个新的公司'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              公司名称
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="输入公司名称"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              autoFocus
            />

            {/* 推荐公司列表 */}
            {!loadingRecommended && recommendedCompanies.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-slate-500 mb-2">推荐公司：</p>
                <div className="flex flex-wrap gap-2">
                  {recommendedCompanies.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setCompanyName(name)}
                      className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            {!forceOpen && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-slate-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
              >
                取消
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className={`${forceOpen ? 'flex-1' : 'flex-1'} px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:opacity-90 transition-opacity font-medium disabled:opacity-50`}
            >
              {loading ? '创建中...' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
