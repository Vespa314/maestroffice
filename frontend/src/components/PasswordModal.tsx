import { useState, useEffect } from 'react';
import { Lock, KeyRound } from 'lucide-react';
import { toast } from 'react-toastify';
import { api } from '../lib/api';

interface PasswordModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  hasPassword: boolean | null;
}

export const PasswordModal: React.FC<PasswordModalProps> = ({ isOpen, onSuccess, hasPassword }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // 根据 hasPassword 判断初始模式：如果后端有密码则使用验证模式，否则使用创建模式
  const [isCreateMode, setIsCreateMode] = useState(hasPassword === false);

  // 当 hasPassword 变化时更新模式
  useEffect(() => {
    if (hasPassword !== null) {
      setIsCreateMode(!hasPassword);
    }
  }, [hasPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password.trim()) {
      toast.error('请输入密码');
      return;
    }

    setIsLoading(true);

    try {
      if (isCreateMode) {
        // 创建密码模式
        if (password !== confirmPassword) {
          toast.error('两次输入的密码不一致');
          setIsLoading(false);
          return;
        }

        if (password.length < 4) {
          toast.error('密码长度至少为4位');
          setIsLoading(false);
          return;
        }

        // 调用创建密码 API
        await api.createAdminPassword(password);
        // 保存到本地
        localStorage.setItem('adminPassword', password);
        toast.success('密码设置成功');
        onSuccess();
      } else {
        // 验证密码模式
        const isValid = await api.verifyAdminPassword(password);
        if (isValid) {
          // 保存到本地
          localStorage.setItem('adminPassword', password);
          onSuccess();
        } else {
          toast.error('密码错误');
        }
      }
    } catch (error: any) {
      if (error.message?.includes('未配置密码') || error.message?.includes('not configured')) {
        // 后端未配置密码，切换到创建模式
        setIsCreateMode(true);
        toast.info('请设置管理密码');
      } else if (error.message?.includes('密码已存在') || error.message?.includes('already exists') || error.message?.includes('403')) {
        // 密码已存在，切换到验证模式
        setIsCreateMode(false);
        toast.info('密码已设置，请验证密码');
      } else {
        toast.error(error.message || '操作失败');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeSwitch = () => {
    setIsCreateMode(!isCreateMode);
    setPassword('');
    setConfirmPassword('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
            {isCreateMode ? (
              <KeyRound className="w-8 h-8 text-white" />
            ) : (
              <Lock className="w-8 h-8 text-white" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-gray-800">
            {isCreateMode ? '设置管理密码' : '输入管理密码'}
          </h2>
          <p className="text-gray-500 text-sm mt-2">
            {isCreateMode ? '首次使用请设置管理密码' : '请输入密码以访问管理系统'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              密码
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder={isCreateMode ? '请输入密码（至少4位）' : '请输入密码'}
              disabled={isLoading}
              autoFocus
            />
          </div>

          {isCreateMode && (
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                确认密码
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="请再次输入密码"
                disabled={isLoading}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '处理中...' : isCreateMode ? '设置密码' : '验证'}
          </button>
        </form>

        {!isCreateMode && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={handleModeSwitch}
              className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
            >
              首次使用？点击设置密码
            </button>
          </div>
        )}

        {isCreateMode && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={handleModeSwitch}
              className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
            >
              已有密码？点击验证
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
