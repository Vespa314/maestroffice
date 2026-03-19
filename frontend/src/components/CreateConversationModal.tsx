import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Check, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { User } from '@/types';

interface CreateConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (title: string, members: string[]) => Promise<void>;
  users: User[];
  currentUsername: string | null;
}

export function CreateConversationModal({
  isOpen,
  onClose,
  onCreate,
  users,
  currentUsername,
}: CreateConversationModalProps) {
  const [title, setTitle] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      // 如果只有两个人，自动勾选所有人
      if (users.length === 2) {
        setSelectedMembers(new Set(users.map(u => u.username)));
      } else {
        setSelectedMembers(new Set([currentUsername || '']));
      }
    }
  }, [isOpen, currentUsername, users]);

  const handleToggleMember = (username: string) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(username)) {
        // Don't allow unselecting current user
        if (username !== currentUsername) {
          next.delete(username);
        }
      } else {
        next.add(username);
      }
      return next;
    });
  };

  const handleAutoName = () => {
    // 将选中的成员按创建人第一位、其他人跟随的顺序排列
    const membersArray = Array.from(selectedMembers);
    const sortedMembers = [
      currentUsername,
      ...membersArray.filter(m => m !== currentUsername)
    ].filter(Boolean);

    // 用逗号连接所有成员名字
    const autoTitle = sortedMembers.join(', ');
    setTitle(autoTitle);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || selectedMembers.size < 2) return;

    try {
      setSubmitting(true);
      await onCreate(title.trim(), Array.from(selectedMembers));
      onClose();
    } catch (err) {
      // Failed to create conversation
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="创建对话" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title Input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="title" className="block text-sm font-medium text-text-primary">
              对话标题 <span className="text-red-500">*</span>
            </label>
            {selectedMembers.size > 1 && (
              <button
                type="button"
                onClick={handleAutoName}
                className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-secondary bg-secondary/10 hover:bg-secondary/20 rounded-md transition-colors"
                title="自动生成群名称"
              >
                <Wand2 className="w-3 h-3" />
                自动命名
              </button>
            )}
          </div>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
            placeholder="请输入对话标题..."
            autoFocus
          />
        </div>

        {/* Members Selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-text-primary">
              选择成员
            </label>
            <span className="text-xs text-text-secondary">
              {selectedMembers.size} 人已选择
            </span>
          </div>

          <div className="max-h-60 overflow-y-auto scrollbar-thin border border-border rounded-lg p-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {users.map((user) => {
                const isSelected = selectedMembers.has(user.username);
                const isCurrentUser = user.username === currentUsername;

                return (
                  <button
                    key={user.username}
                    type="button"
                    onClick={() => handleToggleMember(user.username)}
                    disabled={isCurrentUser}
                    className={cn(
                      'flex items-center gap-2 p-3 rounded-lg transition-all duration-200 cursor-pointer text-left',
                      isSelected
                        ? 'bg-secondary/30 border border-secondary/60 hover:bg-secondary/40'
                        : 'bg-secondary/5 border border-border hover:bg-secondary/15',
                      isCurrentUser && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center font-semibold text-white text-xs flex-shrink-0',
                        user.is_on_duty ? 'bg-green-500' : 'bg-text-muted'
                      )}
                    >
                      {user.username.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-text-primary text-sm truncate">
                        {user.username}
                      </div>
                      {user.is_on_duty && (
                        <div className="text-xs text-secondary">●</div>
                      )}
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-secondary flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary flex-1" disabled={submitting}>
            取消
          </button>
          <button
            type="submit"
            className="btn btn-primary flex-1"
            disabled={submitting || !title.trim() || selectedMembers.size < 2}
          >
            {submitting ? '创建中...' : '创建对话'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
