import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { UserPlus } from 'lucide-react';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (username: string) => Promise<void>;
  recommendedUsers: string[];
}

export function CreateUserModal({ isOpen, onClose, onCreate, recommendedUsers }: CreateUserModalProps) {
  const [username, setUsername] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setUsername('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    try {
      setSubmitting(true);
      await onCreate(username.trim());
      onClose();
    } catch (err) {
      // Failed to create user
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickCreate = async (recommendedUsername: string) => {
    try {
      setSubmitting(true);
      await onCreate(recommendedUsername);
      onClose();
    } catch (err) {
      // Failed to create user
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="添加员工" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Username Input */}
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-text-primary mb-2">
            员工
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="input"
            placeholder="请输入员工名..."
            autoFocus
          />
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn btn-secondary flex-1" disabled={submitting}>
            取消
          </button>
          <button
            type="submit"
            className="btn btn-primary flex-1"
            disabled={submitting || !username.trim()}
          >
            {submitting ? '添加中...' : '添加员工'}
          </button>
        </div>

        {/* Recommended Users */}
        {recommendedUsers.length > 0 && (
          <div className="pt-4 border-t border-border">
            <p className="text-sm font-medium text-text-primary mb-2">
              推荐员工
            </p>
            <div className="flex flex-wrap gap-2">
              {recommendedUsers.map((user) => (
                <button
                  key={user}
                  type="button"
                  onClick={() => handleQuickCreate(user)}
                  disabled={submitting}
                  className="px-3 py-1.5 text-sm bg-primary-light hover:bg-secondary/20 text-text-primary hover:text-secondary rounded-lg border border-border transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UserPlus className="w-3 h-3 inline mr-1" />
                  {user}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
