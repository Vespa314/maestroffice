import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { FileEdit, Loader2 } from 'lucide-react';

interface RenameFileDialogModalProps {
  isOpen: boolean;
  fileName: string;
  onClose: () => void;
  onConfirm: (newFileName: string) => void;
}

export function RenameFileDialogModal({ isOpen, fileName, onClose, onConfirm }: RenameFileDialogModalProps) {
  // 分离文件名和后缀
  const lastDotIndex = fileName.lastIndexOf('.');
  const baseName = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
  const extension = lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : '';

  const [newBaseName, setNewBaseName] = useState(baseName);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setNewBaseName(baseName);
    }
  }, [isOpen, baseName]);

  const handleSubmit = async () => {
    if (!newBaseName.trim()) return;

    setSubmitting(true);
    const fullFileName = newBaseName.trim() + extension;
    await onConfirm(fullFileName);
    setSubmitting(false);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !submitting) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="重命名文件" size="sm">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            文件名
          </label>
          <div className="flex">
            <input
              type="text"
              value={newBaseName}
              onChange={(e) => setNewBaseName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="input rounded-r-none flex-1"
              placeholder="输入文件名"
              autoFocus
            />
            {extension && (
              <span className="inline-flex items-center px-3 bg-border border border-l-0 border-border rounded-r-lg text-text-muted text-sm font-medium">
                {extension}
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted mt-2">
            文件扩展名（后缀）将保持不变
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        <button onClick={onClose} className="btn btn-secondary flex-1" disabled={submitting}>
          取消
        </button>
        <button
          onClick={handleSubmit}
          className="btn btn-primary flex-1 flex items-center justify-center gap-2"
          disabled={submitting || !newBaseName.trim()}
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              处理中...
            </>
          ) : (
            <>
              <FileEdit className="w-4 h-4" />
              确认
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}
