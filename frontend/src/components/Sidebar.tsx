import { useState, useEffect } from 'react';
import { Plus, Users, ArrowLeftRight, Activity, HeartCrack, HeartOff, AlarmClockOff, Settings } from 'lucide-react';
import { ConversationList } from './ConversationList';
import { Modal } from './Modal';
import { SoulEditorModal } from './SoulEditorModal';
import { api } from '@/lib/api';
import type { Conversation, User } from '@/types';

type SendKeyMode = 'enter' | 'ctrlEnter' | 'shiftEnter';
const SEND_KEY_MODE_STORAGE_KEY = 'messageSendKeyMode';

interface SidebarProps {
  conversations: Conversation[];
  selectedConversationId: string | null;
  onSelectConversation: (conversation: Conversation) => void;
  currentCompany: string | null;
  currentUsername: string | null;
  users: User[];
  companies: string[];
  recommendedUsers: string[];
  onRefresh: () => void;
  onCreateConversation: () => void;
  onCreateUser: () => void;
  onSwitchUser: (username: string) => void;
  onFetchRecommendedUsers: () => void;
  onSwitchCompany: (company: string) => void;
  onCreateCompany: () => void;
  userWorkingStatus?: Record<string, boolean>;
}

export function Sidebar({
  conversations,
  selectedConversationId,
  onSelectConversation,
  currentCompany,
  currentUsername,
  users,
  companies,
  recommendedUsers,
  onRefresh,
  onCreateConversation,
  onCreateUser,
  onSwitchUser,
  onFetchRecommendedUsers,
  onSwitchCompany,
  onCreateCompany,
  userWorkingStatus = {},
}: SidebarProps) {
  const [showUserSwitcher, setShowUserSwitcher] = useState(false);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [schedulerAlive, setSchedulerAlive] = useState<boolean | null>(null);
  const [schedulerStopped, setSchedulerStopped] = useState<boolean>(false); // 进程存在但被停止
  const [hasRecentFailures, setHasRecentFailures] = useState<boolean>(false); // 是否有最近的失败记录
  const [showKillConfirm, setShowKillConfirm] = useState(false);
  const [showResumeConfirm, setShowResumeConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCompanySoulEditor, setShowCompanySoulEditor] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [sendKeyMode, setSendKeyMode] = useState<SendKeyMode>(() => {
    const stored = localStorage.getItem(SEND_KEY_MODE_STORAGE_KEY);
    if (stored === 'ctrlEnter' || stored === 'shiftEnter') {
      return stored;
    }
    return 'enter';
  });

  // 监听 localStorage 变化
  useEffect(() => {
    const handleStorageChange = () => {
      const stored = localStorage.getItem(SEND_KEY_MODE_STORAGE_KEY);
      if (stored === 'ctrlEnter' || stored === 'shiftEnter') {
        setSendKeyMode(stored);
      } else {
        setSendKeyMode('enter');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    // 自定义事件，用于同页面内通信
    window.addEventListener('localstorage_changed', handleStorageChange as any);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('localstorage_changed', handleStorageChange as any);
    };
  }, []);

  const changeSendKeyMode = (mode: SendKeyMode) => {
    setSendKeyMode(mode);
    localStorage.setItem(SEND_KEY_MODE_STORAGE_KEY, mode);
    // 触发自定义事件，让其他组件知道设置已更改
    window.dispatchEvent(new Event('localstorage_changed'));
  };

  // 按优先级排序用户：当前用户最前，然后按在岗状态排序
  const sortedUsers = [...users].sort((a, b) => {
    // 当前登录用户排最前面
    if (a.username === currentUsername && b.username !== currentUsername) return -1;
    if (a.username !== currentUsername && b.username === currentUsername) return 1;

    // 然后按在岗状态排序：在岗的排在前面
    if (a.is_on_duty && !b.is_on_duty) return -1;
    if (!a.is_on_duty && b.is_on_duty) return 1;

    return 0;
  });

  // Prevent unused variable warnings
  void recommendedUsers;
  void onFetchRecommendedUsers;
  void onRefresh;

  // 检查调度进程状态
  useEffect(() => {
    const checkSchedulerStatus = async () => {
      try {
        const result = await api.checkHeartbeat() as { alive: boolean; pid: number | null; message: string; has_recent_failures: boolean };
        setSchedulerAlive(result.alive);
        // 如果 pid 存在但进程不存活，说明进程存在但被停止
        setSchedulerStopped(result.pid !== null && !result.alive);
        // 检查是否有最近的失败记录
        setHasRecentFailures(result.has_recent_failures || false);
      } catch (error) {
        console.error('检查调度进程状态失败:', error);
        setSchedulerAlive(false);
        setSchedulerStopped(false);
        setHasRecentFailures(false);
      }
    };

    checkSchedulerStatus();
  }, []);

  // 杀死调度进程（停止）
  const handleKillScheduler = async () => {
    setIsProcessing(true);
    try {
      await api.killHeartbeat();
      // 重新检查状态以正确更新 schedulerAlive、schedulerStopped 和 hasRecentFailures
      const result = await api.checkHeartbeat() as { alive: boolean; pid: number | null; message: string; has_recent_failures: boolean };
      setSchedulerAlive(result.alive);
      setSchedulerStopped(result.pid !== null && !result.alive);
      setHasRecentFailures(result.has_recent_failures || false);
      setShowKillConfirm(false);
    } catch (error) {
      console.error('停止调度进程失败:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // 恢复调度进程
  const handleResumeScheduler = async () => {
    setIsProcessing(true);
    try {
      await api.resumeHeartbeat();
      // 重新检查状态以正确更新 schedulerAlive、schedulerStopped 和 hasRecentFailures
      const result = await api.checkHeartbeat() as { alive: boolean; pid: number | null; message: string; has_recent_failures: boolean };
      setSchedulerAlive(result.alive);
      setSchedulerStopped(result.pid !== null && !result.alive);
      setHasRecentFailures(result.has_recent_failures || false);
      setShowResumeConfirm(false);
    } catch (error) {
      console.error('恢复调度进程失败:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // 获取调度器图标颜色
  const getSchedulerIconColor = () => {
    if (schedulerAlive === null) {
      return 'bg-white/20'; // 加载中
    }
    if (schedulerAlive) {
      return 'bg-emerald-500'; // 存活 - 绿色
    }
    if (schedulerStopped) {
      return 'bg-amber-500'; // 进程存在但已停止 - 橙色
    }
    return 'bg-gray-400'; // 进程不存在 - 灰色
  };

  return (
    <>
      <div className="w-80 border-r border-gray-200 bg-white flex flex-col shadow-soft h-full overflow-hidden">
        {/* Header with Company Switcher */}
        <div className="px-4 py-6 sm:p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600">
          <div className="relative">
            <div
              className="flex items-center gap-3 mb-4 cursor-pointer group"
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${getSchedulerIconColor()} ${schedulerAlive === false && !schedulerStopped ? 'opacity-50' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  // 如果有最近的失败记录，不允许点击改变状态
                  if (hasRecentFailures) {
                    return;
                  }
                  if (schedulerAlive === true) {
                    // 进程存活，点击停止
                    setShowKillConfirm(true);
                  } else if (schedulerStopped) {
                    // 进程存在但被停止，点击恢复
                    setShowResumeConfirm(true);
                  }
                  // 进程不存在时不做任何操作
                }}
              >
                {hasRecentFailures ? (
                  <AlarmClockOff className="w-6 h-6 text-white" />
                ) : schedulerAlive === true ? (
                  <Activity className="w-6 h-6 text-white" />
                ) : schedulerStopped ? (
                  <HeartOff className="w-6 h-6 text-white" />
                ) : (
                  <HeartCrack className="w-6 h-6 text-white" />
                )}
              </div>
              <div
                className="flex-1 min-w-0"
                onClick={() => currentCompany && setShowCompanySoulEditor(true)}
              >
                <h1 className="text-lg font-bold text-white truncate">
                  {currentCompany || '选择公司'}
                  <span className="lg:hidden">
                    {currentCompany && (() => {
                      const workingCount = Object.values(userWorkingStatus).filter(isWorking => isWorking).length;
                      const onDutyCount = users.filter(user => user.is_on_duty).length;
                      return onDutyCount > 0 ? `(${workingCount}/${onDutyCount})` : '';
                    })()}
                  </span>
                </h1>
                <p className="text-xs text-white/90 truncate">
                  AI Company
                  {hasRecentFailures && ' · 有失败记录'}
                  {!hasRecentFailures && schedulerAlive === true && ' · 运行中'}
                  {!hasRecentFailures && schedulerAlive === false && schedulerStopped && ' · 已停止'}
                  {!hasRecentFailures && schedulerAlive === false && !schedulerStopped && ' · 进程未运行'}
                </p>
              </div>
              <ArrowLeftRight
                className={`w-4 h-4 text-white/80 transition-transform ${showCompanyDropdown ? 'rotate-180' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCompanyDropdown(!showCompanyDropdown);
                }}
              />
            </div>

            {/* Company Dropdown */}
            {showCompanyDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowCompanyDropdown(false)}
                />
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-gray-200 shadow-soft-lg max-h-64 overflow-y-auto z-20">
                  <div className="p-2">
                    <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                      <span>切换公司</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCreateCompany();
                          setShowCompanyDropdown(false);
                        }}
                        className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                      >
                        + 新建
                      </button>
                    </div>
                    {companies.map((company) => (
                      <button
                        key={company}
                        onClick={() => {
                          onSwitchCompany(company);
                          setShowCompanyDropdown(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                          company === currentCompany
                            ? 'bg-blue-50 text-blue-600'
                            : 'hover:bg-gray-100 text-slate-700'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-semibold text-sm ${
                          company === currentCompany
                            ? 'bg-blue-600 text-white'
                            : 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white'
                        }`}>
                          {company.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 text-left">
                          <div className={`font-medium text-sm ${
                            company === currentCompany
                              ? 'text-blue-600'
                              : 'text-slate-900'
                          }`}>
                            {company}
                          </div>
                          {company === currentCompany && (
                            <div className="text-xs text-blue-500">当前公司</div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {currentCompany && currentUsername && users.length > 1 && (
            <button
              onClick={onCreateConversation}
              className="w-full px-3 sm:px-4 py-2.5 bg-white hover:bg-gray-50 text-blue-600 rounded-xl font-medium transition-all duration-200 cursor-pointer shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">创建对话</span>
              <span className="sm:hidden">创建</span>
            </button>
          )}
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <ConversationList
            conversations={conversations}
            selectedId={selectedConversationId}
            onSelect={onSelectConversation}
            currentUsername={currentUsername}
          />
        </div>

        {/* Current User Section */}
        <div className="p-3 sm:p-4 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50/50 space-y-2 sm:space-y-3">
          {/* Current User */}
          {currentUsername && (
            <div className="relative">
              <div
                className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-200 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setShowUserSwitcher(!showUserSwitcher)}
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center font-semibold text-white shadow-md">
                  {currentUsername.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 truncate">
                    {currentUsername}
                  </div>
                  <div className="text-xs text-slate-500">当前登录</div>
                </div>
                <ArrowLeftRight className={`w-4 h-4 text-slate-500 transition-transform ${showUserSwitcher ? 'rotate-180' : ''}`} />
              </div>

              {/* User Switcher Popup */}
              {showUserSwitcher && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowUserSwitcher(false)}
                  />
                  <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl border border-gray-200 shadow-soft-lg max-h-64 overflow-y-auto z-20">
                    <div className="p-2">
                      <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        切换当前员工
                      </div>
                      {sortedUsers.map((user) => (
                        <button
                          key={`${user.company_name}:${user.username}`}
                          onClick={() => {
                            onSwitchUser(user.username);
                            setShowUserSwitcher(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                            user.username === currentUsername
                              ? 'bg-blue-50 text-blue-600'
                              : 'hover:bg-gray-100 text-slate-700'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-semibold text-sm ${
                            user.username === currentUsername
                              ? 'bg-blue-600 text-white'
                              : 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white'
                          }`}>
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 text-left">
                            <div className={`font-medium text-sm ${
                              user.username === currentUsername
                                ? 'text-blue-600'
                                : 'text-slate-900'
                            }`}>
                              {user.username}
                            </div>
                            {user.username === currentUsername && (
                              <div className="text-xs text-blue-500">当前员工</div>
                            )}
                          </div>
                          {user.is_on_duty && (
                            <div className="px-2 py-0.5 bg-emerald-100 text-emerald-600 text-xs rounded-full font-medium">
                              在岗
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {currentCompany && (
            <div className="flex gap-2">
              <button
                onClick={onCreateUser}
                className="flex-1 px-3 sm:px-4 py-2.5 bg-white hover:bg-gray-50 text-slate-700 border border-gray-300 rounded-xl transition-all duration-200 cursor-pointer font-medium text-sm flex items-center justify-center gap-2 shadow-sm hover:shadow"
              >
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">员工管理</span>
                <span className="sm:hidden">员工</span>
              </button>

              <button
                onClick={() => setShowSettingsModal(true)}
                className="px-3 sm:px-4 py-2.5 bg-white hover:bg-gray-50 text-slate-700 border border-gray-300 rounded-xl transition-all duration-200 cursor-pointer font-medium text-sm flex items-center justify-center gap-2 shadow-sm hover:shadow"
                title="设置"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Kill Scheduler Confirmation Modal */}
      <Modal
        isOpen={showKillConfirm}
        onClose={() => setShowKillConfirm(false)}
        title="确认停止调度进程"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-slate-700">
            确定要停止调度进程吗？停止后，正在工作的员工处理完本轮任务后将停止工作；
          </p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowKillConfirm(false)}
              disabled={isProcessing}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-slate-700 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              取消
            </button>
            <button
              onClick={handleKillScheduler}
              disabled={isProcessing}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? '停止中...' : '确认停止'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Resume Scheduler Confirmation Modal */}
      <Modal
        isOpen={showResumeConfirm}
        onClose={() => setShowResumeConfirm(false)}
        title="确认恢复调度进程"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-slate-700">
            确定要恢复调度进程吗？恢复后，在岗员工将开始工作。
          </p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowResumeConfirm(false)}
              disabled={isProcessing}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-slate-700 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              取消
            </button>
            <button
              onClick={handleResumeScheduler}
              disabled={isProcessing}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? '恢复中...' : '确认恢复'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Company Soul Editor Modal */}
      <SoulEditorModal
        isOpen={showCompanySoulEditor}
        onClose={() => setShowCompanySoulEditor(false)}
        role={currentCompany || ''}
        type="company"
      />

      {/* Settings Modal */}
      <Modal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        title="设置"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              发送消息快捷键
            </label>
            <select
              value={sendKeyMode}
              onChange={(e) => changeSendKeyMode(e.target.value as SendKeyMode)}
              className="w-full px-3 py-2.5 bg-white border-2 border-gray-300 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all duration-200 cursor-pointer"
            >
              <option value="enter">Enter 发送</option>
              <option value="ctrlEnter">Ctrl/Cmd + Enter 发送</option>
              <option value="shiftEnter">Shift + Enter 发送</option>
            </select>
            <p className="text-xs text-slate-500 mt-2">
              {sendKeyMode === 'enter' && '按 Enter 发送消息，Shift+Enter 换行'}
              {sendKeyMode === 'ctrlEnter' && '按 Ctrl/Cmd+Enter 发送消息，Enter 换行'}
              {sendKeyMode === 'shiftEnter' && '按 Shift+Enter 发送消息，Enter 换行'}
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}
