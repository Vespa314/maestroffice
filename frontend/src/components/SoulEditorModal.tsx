import { useState, useEffect, useCallback } from 'react';
import { Modal } from './Modal';
import { api } from '@/lib/api';
import { Save, Loader2 } from 'lucide-react';

interface SoulEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: string;
  zIndex?: number;
  type?: 'user' | 'company';  // 区分用户soul和公司soul
}

export function SoulEditorModal({ isOpen, onClose, role, zIndex, type = 'user' }: SoulEditorModalProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && role) {
      // 清空之前的内容和错误
      setContent('');
      setError(null);

      // 加载 Soul 文件
      const loadSoul = async () => {
        try {
          setLoading(true);
          setError(null);
          const data = type === 'company'
            ? await api.getCompanySoul(role)
            : await api.getSoul(role);
          setContent(data.content);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load soul');
          // 404 或其他错误时清空内容
          setContent('');
        } finally {
          setLoading(false);
        }
      };

      loadSoul();
    } else if (!isOpen) {
      // 关闭时清空状态
      setContent('');
      setError(null);
      setLoading(false);
    }
  }, [isOpen, role]);

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      setError(null);
      if (type === 'company') {
        await api.updateCompanySoul(role, content);
      } else {
        await api.updateSoul(role, content);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save soul');
    } finally {
      setSaving(false);
    }
  }, [role, content, onClose, type]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && isOpen) {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleSave]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${type === 'company' ? '公司' : ''} Soul 文件 - ${role}`} size="xl" zIndex={zIndex}>
      <div className="h-[60vh] flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-secondary" />
          </div>
        ) : (
          <>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 w-full p-4 bg-background border border-border rounded-lg text-text-primary font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-secondary"
              placeholder="# Soul 文件内容..."
            />

            {error && (
              <div className="mt-3 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <button onClick={onClose} className="btn btn-secondary flex-1" disabled={saving}>
                取消
              </button>
              <button
                onClick={handleSave}
                className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    保存
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
