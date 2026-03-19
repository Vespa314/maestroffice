import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { User } from '@/types';
import { AlertCircle, ArrowLeftRight, Brain, Circle, FolderOpen, GitCommitVertical, Loader2, Trash2, UserPlus, Users, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Avatar } from './Avatar';
import { Modal } from './Modal';
import { SkillsManagerModal } from './SkillsManagerModal';
import { SoulEditorModal } from './SoulEditorModal';
import { TimelineViewerModal } from './TimelineViewerModal';
import { TooltipWrapper as Tooltip } from './Tooltip';
import { WorkspaceViewerModal } from './WorkspaceViewerModal';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  currentCompany: string | null;
  currentUsername: string | null;
  recommendedUsers: string[];
  onSwitchUser: (username: string) => void;
  onToggleOnDuty: (username: string, isOnDuty: boolean) => Promise<void>;
  onCreateUser: (username: string) => Promise<void>;
  onDeleteUser: (username: string) => Promise<void>;
  onRefresh: () => void;
  userWorkingStatus?: Record<string, boolean>;
}

export function UserManagementModal({
  isOpen,
  onClose,
  users,
  currentUsername,
  recommendedUsers,
  onSwitchUser,
  onToggleOnDuty,
  onCreateUser,
  onDeleteUser,
  onRefresh,
  userWorkingStatus = {},
}: UserManagementModalProps) {
  const [creatingUser, setCreatingUser] = useState<string | null>(null);
  const [batchCreating, setBatchCreating] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [soulEditorRole, setSoulEditorRole] = useState<string | null>(null);
  const [skillsManagerUsername, setSkillsManagerUsername] = useState<string | null>(null);
  const [workspaceViewerRole, setWorkspaceViewerRole] = useState<string | null>(null);
  const [timelineViewerUsername, setTimelineViewerUsername] = useState<string | null>(null);
  const [dutyError, setDutyError] = useState<string | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<string | null>(null);

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

  useEffect(() => {
    if (isOpen) {
      setNewUsername('');
      setDutyError(null);
    }
  }, [isOpen]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;

    try {
      setCreatingUser(newUsername.trim());
      await onCreateUser(newUsername.trim());
      setNewUsername('');
      onRefresh();
    } catch (err) {
      // Failed to create user
    } finally {
      setCreatingUser(null);
    }
  };

  const handleQuickCreateUser = async (username: string) => {
    try {
      setCreatingUser(username);
      await onCreateUser(username);
      onRefresh();
    } catch (err) {
      // Failed to create user
    } finally {
      setCreatingUser(null);
    }
  };

  const handleBatchCreateUsers = async () => {
    try {
      setBatchCreating(true);
      // 过滤掉已经存在的用户
      const existingUsernames = new Set(users.map(u => u.username));
      const usersToCreate = recommendedUsers.filter(user => !existingUsernames.has(user));

      // 批量创建用户
      for (const username of usersToCreate) {
        try {
          await onCreateUser(username);
        } catch (err) {
          // Failed to create user
        }
      }
      onRefresh();
    } catch (err) {
      // Failed to batch create users
    } finally {
      setBatchCreating(false);
    }
  };

  const handleToggleOnDuty = async (username: string, isOnDuty: boolean) => {
    // 如果要设为在线，需要验证 Soul 文件
    if (isOnDuty) {
      try {
        // 检查 Soul 文件是否存在且非空
        const data = await api.getSoul(username);
        if (!data.content || data.content.trim() === '') {
          setDutyError(`${username} 的 Soul 文件为空，请先配置 Soul 文件后再设置为在线状态`);
          return;
        }
      } catch (err) {
        setDutyError(`${username} 的 Soul 文件不存在，请先创建 Soul 文件后再设置为在线状态`);
        return;
      }
    }

    // 验证通过，执行切换
    await onToggleOnDuty(username, isOnDuty);
    onRefresh();
  };

  const handleDeleteUser = async (username: string) => {
    try {
      setDeletingUser(username);
      await onDeleteUser(username);
      setDeleteConfirmUser(null);
      onRefresh();
    } catch (err) {
      // Failed to delete user
    } finally {
      setDeletingUser(null);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="员工管理" size="lg">
      <div className="space-y-2 max-h-[60vh] overflow-y-auto scrollbar-thin">
        {sortedUsers.map((user) => {
          const isCurrentUser = user.username === currentUsername;

          return (
            <div
              key={user.username}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border border-border bg-primary-light/50',
                isCurrentUser && 'border-secondary/50'
              )}
            >
              {/* Avatar + Info */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div>
                  <div className="flex flex-col items-center">
                    <div className="relative">
                      <Avatar username={user.username} size="lg" className="w-8 h-8 text-xs sm:w-12 sm:h-12 sm:text-base" />
                      {userWorkingStatus[user.username] && (
                        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-white border-r-gray-800 border-b-white border-l-gray-800 animate-spin" style={{ animationDuration: '2s' }}></div>
                      )}
                    </div>
                    <span className="block sm:hidden text-xs">
                      {user.username}
                    </span>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-primary truncate hidden sm:block">
                      {user.username}
                    </span>
                    {isCurrentUser && (
                      <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full bg-secondary/20 text-secondary">
                        当前
                      </span>
                    )}
                    {user.is_on_duty && (
                      <span className="flex-shrink-0 flex items-center gap-1 text-xs text-secondary hidden sm:flex">
                        <Circle className="w-2 h-2 fill-secondary" />
                        在线
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Switch User */}
                {!isCurrentUser && (
                  <Tooltip content="切换到此员工">
                    <button
                      onClick={() => onSwitchUser(user.username)}
                      className="p-1 sm:p-2 rounded hover:bg-secondary/20 text-text-secondary hover:text-secondary transition-colors cursor-pointer"
                      aria-label={`切换到 ${user.username}`}
                    >
                      <ArrowLeftRight className="w-4 h-4" />
                    </button>
                  </Tooltip>
                )}

                {/* Toggle On Duty */}
                <Tooltip content={user.is_on_duty ? '设为离线' : '设为在线'}>
                  <button
                    onClick={() => handleToggleOnDuty(user.username, !user.is_on_duty)}
                    className={cn(
                      'p-1 sm:p-2 rounded transition-colors cursor-pointer',
                      user.is_on_duty
                        ? 'text-secondary hover:bg-secondary/20'
                        : 'text-text-muted hover:bg-primary-light'
                    )}
                    aria-label={`${user.is_on_duty ? '设为离线' : '设为在线'}`}
                  >
                    <Circle className={cn('w-4 h-4', user.is_on_duty && 'fill-secondary')} />
                  </button>
                </Tooltip>

                {/* Timeline */}
                <Tooltip content="查看行为记录">
                  <button
                    onClick={() => setTimelineViewerUsername(user.username)}
                    className="p-1 sm:p-2 rounded hover:bg-primary-light text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                    aria-label={`查看 ${user.username} 的行为记录`}
                  >
                    <GitCommitVertical className="w-4 h-4" />
                  </button>
                </Tooltip>

                {/* Soul File */}
                <Tooltip content="配置 Soul 文件">
                  <button
                    onClick={() => setSoulEditorRole(user.username)}
                    className="p-1 sm:p-2 rounded hover:bg-primary-light text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                    aria-label={`配置 ${user.username} 的 Soul 文件`}
                  >
                    <Brain className="w-4 h-4" />
                  </button>
                </Tooltip>

                {/* Skills */}
                <Tooltip content="管理技能配置">
                  <button
                    onClick={() => setSkillsManagerUsername(user.username)}
                    className="p-1 sm:p-2 rounded hover:bg-primary-light text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                    aria-label={`配置 ${user.username} 的技能`}
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                </Tooltip>

                {/* Workspace */}
                <Tooltip content="查看工作台文件">
                  <button
                    onClick={() => setWorkspaceViewerRole(user.username)}
                    className="p-1 sm:p-2 rounded hover:bg-primary-light text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                    aria-label={`查看 ${user.username} 的工作台`}
                  >
                    <FolderOpen className="w-4 h-4" />
                  </button>
                </Tooltip>

                {/* Delete User */}
                <Tooltip content="删除员工">
                  <button
                    onClick={() => setDeleteConfirmUser(user.username)}
                    disabled={deletingUser === user.username}
                    className="p-1 sm:p-2 rounded hover:bg-red-500/20 text-text-muted hover:text-red-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={`删除员工 ${user.username}`}
                  >
                    {deletingUser === user.username ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </Tooltip>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create User Form */}
      <div className="mt-4 pt-4 border-t border-border">
        <form onSubmit={handleCreateUser} className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="员工名字"
              className="flex-1 input"
            />
            <button
              type="submit"
              disabled={!newUsername.trim() || creatingUser !== null}
              className="btn btn-primary flex items-center justify-center gap-2 px-6"
            >
              {creatingUser ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  录取中...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  招聘
                </>
              )}
            </button>
          </div>
        </form>

        {/* Recommended Users */}
        {recommendedUsers.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-text-secondary">
                推荐员工
              </p>
              <button
                onClick={handleBatchCreateUsers}
                disabled={batchCreating || creatingUser !== null}
                className="text-xs px-3 py-1.5 bg-secondary/20 hover:bg-secondary/30 text-secondary rounded-lg border border-secondary/30 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {batchCreating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    创建中...
                  </>
                ) : (
                  <>
                    <Users className="w-3.5 h-3.5" />
                    全部录用
                  </>
                )}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recommendedUsers.map((user) => (
                <button
                  key={user}
                  onClick={() => handleQuickCreateUser(user)}
                  disabled={creatingUser === user}
                  className="px-3 py-2 text-sm bg-primary-light hover:bg-secondary/20 text-text-primary hover:text-secondary rounded-lg border border-border transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {creatingUser === user ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      创建中...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      {user}
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error Alert */}
        {dutyError && (
          <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-400">{dutyError}</p>
              <button
                onClick={() => setDutyError(null)}
                className="mt-2 text-xs text-red-300 hover:text-red-200 underline cursor-pointer"
              >
                关闭
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>

    {/* Delete Confirmation Modal */}
    <Modal
      isOpen={deleteConfirmUser !== null}
      onClose={() => setDeleteConfirmUser(null)}
      title="确认删除员工"
      size="sm"
      zIndex={55}
    >
      <div className="space-y-4">
        <p className="text-text-primary">
          确定要删除员工 <span className="font-bold text-secondary">{deleteConfirmUser}</span> 吗？
        </p>
        <p className="text-sm text-text-secondary">
          此操作将：
        </p>
        <ul className="text-sm text-text-secondary list-disc list-inside space-y-1">
          <li>从数据库中删除该员工</li>
          <li>从所有对话中移除该员工</li>
          <li>删除 staff/{deleteConfirmUser} 目录</li>
        </ul>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => setDeleteConfirmUser(null)}
            disabled={deletingUser !== null}
            className="px-4 py-2 rounded-lg border border-border text-text-primary hover:bg-primary-light transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            取消
          </button>
          <button
            onClick={() => deleteConfirmUser && handleDeleteUser(deleteConfirmUser)}
            disabled={deletingUser !== null}
            className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {deletingUser ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                删除中...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                确认删除
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>

    {/* Sub-modals rendered with Portal to body */}
    {typeof document !== 'undefined' && createPortal(
      <>
        <SoulEditorModal
          isOpen={soulEditorRole !== null}
          onClose={() => setSoulEditorRole(null)}
          role={soulEditorRole || ''}
          zIndex={60}
        />

        <SkillsManagerModal
          isOpen={skillsManagerUsername !== null}
          onClose={() => setSkillsManagerUsername(null)}
          username={skillsManagerUsername || ''}
          zIndex={60}
        />

        <WorkspaceViewerModal
          isOpen={workspaceViewerRole !== null}
          onClose={() => setWorkspaceViewerRole(null)}
          role={workspaceViewerRole || ''}
          zIndex={60}
        />

        <TimelineViewerModal
          isOpen={timelineViewerUsername !== null}
          onClose={() => setTimelineViewerUsername(null)}
          username={timelineViewerUsername || ''}
          zIndex={60}
        />
      </>,
      document.body
    )}
  </>
  );
}
