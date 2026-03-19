import { useState, useEffect } from 'react';
import { X, Search, Check, Users } from 'lucide-react';
import { Avatar } from './Avatar';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { User } from '@/types';

interface SelectUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddUsers: (usernames: string[]) => Promise<void>;
  existingMembers: string[];
  currentUsername: string | null;
}

export function SelectUsersModal({
  isOpen,
  onClose,
  onAddUsers,
  existingMembers,
  currentUsername,
}: SelectUsersModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  // 加载用户列表
  useEffect(() => {
    if (isOpen) {
      loadUsers();
      setSelectedUsers(new Set());
      setSearchQuery('');
    }
  }, [isOpen]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      // Failed to load users
    } finally {
      setLoading(false);
    }
  };

  // 过滤用户：排除已在对话中的成员和当前用户
  const availableUsers = users.filter(
    (u) => !existingMembers.includes(u.username) && u.username !== currentUsername
  );

  // 根据搜索查询进一步过滤
  const filteredUsers = availableUsers.filter((u) =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleUser = (username: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(username)) {
      newSelected.delete(username);
    } else {
      newSelected.add(username);
    }
    setSelectedUsers(newSelected);
  };

  const handleAddUsers = async () => {
    if (selectedUsers.size === 0) return;

    try {
      setAdding(true);
      await onAddUsers(Array.from(selectedUsers));
      onClose();
    } catch (err) {
      // Failed to add users
    } finally {
      setAdding(false);
    }
  };

  const selectAll = () => {
    setSelectedUsers(new Set(filteredUsers.map((u) => u.username)));
  };

  const deselectAll = () => {
    setSelectedUsers(new Set());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-indigo-500 to-purple-600">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-white" />
            <h2 className="text-lg font-semibold text-white">添加成员</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索员工..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              autoFocus
            />
          </div>

          {/* Selection Actions */}
          {filteredUsers.length > 0 && (
            <div className="flex items-center gap-2 mt-3 text-sm">
              <span className="text-slate-500 dark:text-slate-400">
                已选择 {selectedUsers.size} / {filteredUsers.length} 人
              </span>
              <div className="flex-1" />
              <button
                onClick={selectAll}
                className="px-3 py-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors cursor-pointer text-xs font-medium"
              >
                全选
              </button>
              <button
                onClick={deselectAll}
                className="px-3 py-1 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer text-xs font-medium"
              >
                清空
              </button>
            </div>
          )}
        </div>

        {/* Users List */}
        <div className="max-h-96 overflow-y-auto scrollbar-thin">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
                <p className="text-sm text-slate-500 dark:text-slate-400">加载员工列表...</p>
              </div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Users className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {searchQuery ? '没有找到匹配的员工' : '没有可添加的员工'}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-2">
              {filteredUsers.map((user) => {
                const isSelected = selectedUsers.has(user.username);
                return (
                  <button
                    key={user.username}
                    onClick={() => toggleUser(user.username)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer text-left',
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-500 dark:border-indigo-500'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 border-2 border-transparent'
                    )}
                  >
                    {/* Checkbox */}
                    <div
                      className={cn(
                        'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0',
                        isSelected
                          ? 'bg-indigo-500 border-indigo-500'
                          : 'border-slate-300 dark:border-slate-600'
                      )}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>

                    {/* Avatar */}
                    <Avatar username={user.username} size="sm" />

                    {/* Username */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          'text-sm font-medium truncate',
                          isSelected
                            ? 'text-indigo-700 dark:text-indigo-300'
                            : 'text-slate-900 dark:text-slate-100'
                        )}
                      >
                        {user.username}
                      </p>
                    </div>

                    {/* On Duty Status */}
                    {user.is_on_duty && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                        在岗
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors cursor-pointer font-medium text-sm border border-slate-200 dark:border-slate-700"
          >
            取消
          </button>
          <button
            onClick={handleAddUsers}
            disabled={selectedUsers.size === 0 || adding}
            className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-lg transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm flex items-center gap-2 shadow-lg hover:shadow-xl"
          >
            {adding ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                添加中...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                添加 {selectedUsers.size > 0 && `(${selectedUsers.size})`}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
