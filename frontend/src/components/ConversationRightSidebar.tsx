import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Check, FolderOpen, GitCommitVertical, Loader2, Megaphone, UserPlus, Users, X, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Avatar } from './Avatar';
import { SelectUsersModal } from './SelectUsersModal';
import { SkillsManagerModal } from './SkillsManagerModal';
import { SoulEditorModal } from './SoulEditorModal';
import { TimelineViewerModal } from './TimelineViewerModal';
import { TooltipWrapper as Tooltip } from './Tooltip';
import { WorkspaceViewerModal } from './WorkspaceViewerModal';

interface ConversationRightSidebarProps {
  conversationId: string | null;
  title: string;
  announcement: string;
  members: string[];
  currentUsername: string | null;
  onRefresh: () => void;
  onClose?: () => void;
  userWorkingStatus?: Record<string, boolean>;
}

export function ConversationRightSidebar({
  conversationId,
  announcement,
  members,
  currentUsername,
  onRefresh,
  onClose,
  userWorkingStatus = {},
}: ConversationRightSidebarProps) {
  const [editingAnnouncement, setEditingAnnouncement] = useState(false);
  const [announcementText, setAnnouncementText] = useState(announcement);
  const [showSelectUsersModal, setShowSelectUsersModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [soulEditorMember, setSoulEditorMember] = useState<string | null>(null);
  const [skillsManagerMember, setSkillsManagerMember] = useState<string | null>(null);
  const [timelineViewerMember, setTimelineViewerMember] = useState<string | null>(null);
  const [userOnDutyMap, setUserOnDutyMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setAnnouncementText(announcement);
  }, [announcement]);

  const fetchUserOnDutyStatus = async () => {
    try {
      const users = await api.getUsers();
      const onDutyMap: Record<string, boolean> = {};
      users.forEach(user => {
        onDutyMap[user.username] = user.is_on_duty;
      });
      setUserOnDutyMap(onDutyMap);
    } catch (err) {
      console.error('Failed to fetch user on-duty status:', err);
    }
  };

  useEffect(() => {
    fetchUserOnDutyStatus();
  }, [onRefresh, members]);

  const handleUpdateAnnouncement = async () => {
    if (!conversationId) return;

    try {
      setUpdating(true);
      await api.updateConversation(conversationId, undefined, announcementText);
      setEditingAnnouncement(false);
      onRefresh();
    } catch (err) {
      // Failed to update announcement
    } finally {
      setUpdating(false);
    }
  };

  const handleAddUsers = async (usernames: string[]) => {
    if (!conversationId) return;

    try {
      await api.addConversationMembersBatch(conversationId, usernames);
      onRefresh();
    } catch (err) {
      // Failed to add users
      throw err;
    }
  };

  const handleRemoveMember = async (username: string) => {
    if (!conversationId) return;

    try {
      await api.removeConversationMember(conversationId, username);
      onRefresh();
    } catch (err) {
      // Failed to remove member
    }
  };

  const handleOpenWorkspace = (username: string) => {
    setSelectedMember(username);
    setShowWorkspaceModal(true);
  };

  const handleCloseWorkspace = () => {
    setShowWorkspaceModal(false);
    setSelectedMember(null);
  };

  if (!conversationId) return null;

  return (
    <div className="w-80 max-w-[85vw] sm:max-w-xs bg-white border-l border-gray-200 flex flex-col h-full">
      {/* Mobile Close Button Header */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-gray-200 sticky top-0 bg-white z-10">
        <h2 className="font-semibold text-slate-900">详情</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-lg text-slate-600 hover:bg-gray-100 transition-colors"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin pb-safe-bottom">
        {/* Announcement Section */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Megaphone className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-slate-900">公告</h3>
          </div>

          {editingAnnouncement ? (
            <div className="space-y-3">
              <textarea
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-blue-500 resize-none transition-colors"
                placeholder="输入公告内容..."
                rows={3}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleUpdateAnnouncement}
                  disabled={updating}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg transition-all duration-200 cursor-pointer disabled:opacity-50 font-medium text-sm flex items-center justify-center gap-2"
                >
                  {updating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      保存
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setEditingAnnouncement(false);
                    setAnnouncementText(announcement);
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-slate-700 rounded-lg transition-colors cursor-pointer font-medium text-sm"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div
              className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setEditingAnnouncement(true)}
            >
              {announcement ? (
                <p className="text-sm text-slate-700 leading-relaxed">
                  {announcement}
                </p>
              ) : (
                <p className="text-sm text-slate-400 italic">
                  点击编辑公告...
                </p>
              )}
            </div>
          )}
        </div>

        {/* Members Section */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-slate-900">
                成员 ({members.length})
              </h3>
            </div>
          </div>

          {/* Member List */}
          <div className="space-y-2">
            {members.map((member) => {
              const isCurrentUser = member === currentUsername;
              return (
                <div
                  key={member}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border transition-all duration-200',
                    isCurrentUser
                      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300'
                      : 'bg-white border-gray-200'
                  )}
                >
                  <div
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer group"
                    onClick={() => setSoulEditorMember(member)}
                  >
                    <div className="relative">
                      <Avatar username={member} size="sm" />
                      {/* Working Status Indicator - Rotating border effect */}
                      {userWorkingStatus[member] && (
                        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-white border-r-gray-800 border-b-white border-l-gray-800 animate-spin" style={{ animationDuration: '2s' }}></div>
                      )}
                    </div>
                    <div className="">
                      <div className="relative">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {member}
                        </p>
                        {userOnDutyMap[member] && (
                          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1">
                            <div className="w-4 h-1 bg-green-500 rounded-full"></div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center flex-shrink-0">
                    <Tooltip content="查看行为记录">
                      <button
                        onClick={() => setTimelineViewerMember(member)}
                        className="p-1 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 transition-all cursor-pointer"
                        aria-label={`查看 ${member} 的行为记录`}
                      >
                        <GitCommitVertical className="w-4 h-4" />
                      </button>
                    </Tooltip>
                    <Tooltip content="管理技能配置">
                      <button
                        onClick={() => setSkillsManagerMember(member)}
                        className="p-1 rounded-lg text-slate-400 hover:text-yellow-600 hover:bg-yellow-50 transition-all cursor-pointer"
                        aria-label={`查看 ${member} 的技能`}
                      >
                        <Zap className="w-4 h-4" />
                      </button>
                    </Tooltip>
                    <Tooltip content="查看工作台文件">
                      <button
                        onClick={() => handleOpenWorkspace(member)}
                        className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer"
                        aria-label={`查看 ${member} 的工作台`}
                      >
                        <FolderOpen className="w-4 h-4" />
                      </button>
                    </Tooltip>
                    <Tooltip content="移除成员">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveMember(member);
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer"
                        aria-label={`移除 ${member}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Member Button */}
          <button
            onClick={() => setShowSelectUsersModal(true)}
            className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 text-slate-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all cursor-pointer text-sm font-medium"
          >
            <UserPlus className="w-4 h-4" />
            添加成员
          </button>
        </div>
      </div>

      {/* Select Users Modal */}
      <SelectUsersModal
        isOpen={showSelectUsersModal}
        onClose={() => setShowSelectUsersModal(false)}
        onAddUsers={handleAddUsers}
        existingMembers={members}
        currentUsername={currentUsername}
      />

      {/* Workspace Viewer Modal */}
      {selectedMember && (
        <WorkspaceViewerModal
          isOpen={showWorkspaceModal}
          onClose={handleCloseWorkspace}
          role={selectedMember}
        />
      )}

      {/* Soul Editor Modal */}
      {soulEditorMember && (
        <SoulEditorModal
          isOpen={soulEditorMember !== null}
          onClose={() => setSoulEditorMember(null)}
          role={soulEditorMember}
        />
      )}

      {/* Skills Manager Modal */}
      {skillsManagerMember && (
        <SkillsManagerModal
          isOpen={skillsManagerMember !== null}
          onClose={() => setSkillsManagerMember(null)}
          username={skillsManagerMember}
        />
      )}

      {/* Timeline Viewer Modal */}
      {timelineViewerMember && (
        <TimelineViewerModal
          isOpen={timelineViewerMember !== null}
          onClose={() => setTimelineViewerMember(null)}
          username={timelineViewerMember}
        />
      )}
    </div>
  );
}
