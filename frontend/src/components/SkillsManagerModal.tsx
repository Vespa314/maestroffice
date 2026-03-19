import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { api } from '@/lib/api';
import { Check, Loader2, Zap, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SkillsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  zIndex?: number;
}

export function SkillsManagerModal({ isOpen, onClose, username, zIndex }: SkillsManagerModalProps) {
  const [allSkills, setAllSkills] = useState<string[]>([]);
  const [userSkills, setUserSkills] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updatingSkill, setUpdatingSkill] = useState<string | null>(null);
  const [updatedSkills, setUpdatedSkills] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && username) {
      // 清空之前的状态
      setAllSkills([]);
      setUserSkills(new Set());
      setError(null);
      setUpdatedSkills(new Set());

      // 加载技能
      const loadSkills = async () => {
        try {
          setLoading(true);
          setError(null);
          const [allData, userData] = await Promise.all([
            api.getSkills(),
            api.getUserSkills(username),
          ]);
          setAllSkills(allData.skills);
          setUserSkills(new Set(userData.skills));
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load skills');
        } finally {
          setLoading(false);
        }
      };

      loadSkills();
    } else if (!isOpen) {
      // 关闭时清空状态
      setAllSkills([]);
      setUserSkills(new Set());
      setError(null);
      setLoading(false);
      setUpdatedSkills(new Set());
    }
  }, [isOpen, username]);

  const handleToggleSkill = async (skill: string) => {
    const isAdding = !userSkills.has(skill);

    // Optimistic update
    const newUserSkills = new Set(userSkills);
    if (isAdding) {
      newUserSkills.add(skill);
    } else {
      newUserSkills.delete(skill);
    }
    setUserSkills(newUserSkills);

    try {
      setUpdating(true);
      setError(null);

      if (isAdding) {
        await api.addUserSkill(username, skill);
      } else {
        await api.removeUserSkill(username, skill);
      }
    } catch (err) {
      // Revert on error
      setUserSkills(new Set(userSkills));
      setError(err instanceof Error ? err.message : 'Failed to update skill');
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateSkill = async (skill: string) => {
    try {
      setUpdatingSkill(skill);
      setError(null);

      await api.updateUserSkill(username, skill);

      // 添加到已更新列表
      setUpdatedSkills(prev => new Set(prev).add(skill));

      // 3秒后清除更新成功状态
      setTimeout(() => {
        setUpdatedSkills(prev => {
          const newSet = new Set(prev);
          newSet.delete(skill);
          return newSet;
        });
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update skill');
    } finally {
      setUpdatingSkill(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`技能配置 - ${username}`} size="md" zIndex={zIndex}>
      <div className="space-y-2 max-h-[60vh] overflow-y-auto scrollbar-thin">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-secondary" />
          </div>
        ) : (
          allSkills.map((skill) => {
            const isInstalled = userSkills.has(skill);
            const isOfficeSkill = skill === '办公';
            const isSkillUpdating = updatingSkill === skill;
            const isUpdated = updatedSkills.has(skill);

            return (
              <div
                key={skill}
                onClick={() => !isOfficeSkill && handleToggleSkill(skill)}
                className={cn(
                  'flex items-center justify-between p-4 rounded-lg border transition-all duration-200',
                  isInstalled
                    ? 'bg-secondary/30 border-secondary/60 hover:bg-secondary/40'
                    : 'bg-secondary/5 border-border hover:bg-secondary/15',
                  (!isOfficeSkill || isInstalled) && 'hover:border-secondary/30',
                  isOfficeSkill ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer',
                  updating && 'cursor-not-allowed'
                )}
              >
                <div className="flex items-center gap-3 flex-1">
                  <Zap className={cn(
                    'w-5 h-5',
                    isInstalled ? 'text-secondary' : 'text-text-muted'
                  )} />
                  <span className="font-medium text-text-primary">
                    {skill}
                    {isOfficeSkill && (
                      <span className="ml-2 text-xs text-text-muted">(默认技能)</span>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {isInstalled && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateSkill(skill);
                      }}
                      disabled={isSkillUpdating}
                      className={cn(
                        'p-2 rounded-lg transition-all duration-200',
                        'hover:bg-secondary/20',
                        isSkillUpdating && 'opacity-50 cursor-not-allowed',
                        isUpdated && 'bg-green-500/20 hover:bg-green-500/30'
                      )}
                      title="更新技能"
                    >
                      {isSkillUpdating ? (
                        <Loader2 className="w-4 h-4 animate-spin text-secondary" />
                      ) : isUpdated ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <RefreshCw className="w-4 h-4 text-text-muted" />
                      )}
                    </button>
                  )}
                  {!isSkillUpdating && isInstalled && !isUpdated && (
                    <Check className="w-5 h-5 text-secondary" />
                  )}
                </div>
              </div>
            );
          })
        )}

        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <button onClick={onClose} className="btn btn-secondary w-full" disabled={updating}>
          关闭
        </button>
      </div>
    </Modal>
  );
}
