import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { FileText, Plus, X, Loader2 } from 'lucide-react';

interface Attachment {
  filename: string;
  content: string;
}

interface CreateTextAttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddAttachments: (attachments: Attachment[]) => Promise<void>;
}

export function CreateTextAttachmentModal({ isOpen, onClose, onAddAttachments }: CreateTextAttachmentModalProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([
    { filename: '', content: '' }
  ]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAttachments([{ filename: '', content: '' }]);
    }
  }, [isOpen]);

  const addAttachment = () => {
    setAttachments([...attachments, { filename: '', content: '' }]);
  };

  const removeAttachment = (index: number) => {
    if (attachments.length === 1) {
      setAttachments([{ filename: '', content: '' }]);
    } else {
      setAttachments(attachments.filter((_, i) => i !== index));
    }
  };

  const updateAttachment = (index: number, field: keyof Attachment, value: string) => {
    const updated = [...attachments];
    updated[index] = { ...updated[index], [field]: value };
    setAttachments(updated);
  };

  const handleSubmit = async () => {
    // 检查所有附件是否都填写完整
    if (!attachments.every(a => a.filename.trim() && a.content.trim())) {
      return;
    }

    const validAttachments = attachments.map(a => ({
      ...a,
      filename: a.filename.trim().endsWith('.md')
        ? a.filename.trim()
        : `${a.filename.trim()}.md`
    }));

    setSubmitting(true);
    await onAddAttachments(validAttachments);
    setSubmitting(false);
  };

  const isValid = attachments.length > 0 && attachments.every(a => a.filename.trim() && a.content.trim());

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="创建文本附件" size="lg">
      <div className="space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
        {attachments.map((attachment, index) => (
          <div key={index} className="p-4 border border-border rounded-lg bg-primary-light/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                <FileText className="w-4 h-4" />
                附件 {index + 1}
              </div>
              {attachments.length > 1 && (
                <button
                  onClick={() => removeAttachment(index)}
                  className="p-1 rounded hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors cursor-pointer"
                  aria-label="删除附件"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                文件名
              </label>
              <div className="flex">
                <input
                  type="text"
                  value={attachment.filename}
                  onChange={(e) => updateAttachment(index, 'filename', e.target.value)}
                  className="input rounded-r-none"
                  placeholder="document"
                />
                <span className="inline-flex items-center px-3 bg-border border border-l-0 border-border rounded-r-lg text-text-muted text-sm font-medium">
                  .md
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                内容 (Markdown)
              </label>
              <textarea
                value={attachment.content}
                onChange={(e) => updateAttachment(index, 'content', e.target.value)}
                className="w-full h-32 p-3 bg-background border border-border rounded-lg text-text-primary font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-secondary"
                placeholder="# 附件内容..."
              />
            </div>
          </div>
        ))}

        <button
          onClick={addAttachment}
          className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-border rounded-lg text-text-secondary hover:text-text-primary hover:border-secondary/50 transition-all duration-200 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          添加更多附件
        </button>
      </div>

      <div className="mt-4 flex gap-3">
        <button onClick={onClose} className="btn btn-secondary flex-1" disabled={submitting}>
          取消
        </button>
        <button
          onClick={handleSubmit}
          className="btn btn-primary flex-1 flex items-center justify-center gap-2"
          disabled={submitting || !isValid}
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              添加中...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              添加附件
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}
