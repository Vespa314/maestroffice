import { useState, useEffect } from 'react';
import { X, Crosshair } from 'lucide-react';
import { api } from '@/lib/api';
import { FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Attachment } from '@/types';

interface ConversationAttachmentsPanelProps {
  conversationId: string | null;
  onOpenAttachment: (attachment: Attachment) => void;
  onJumpToMessage?: (messageId: string) => void;
  isOpen: boolean;
  onClose: () => void;
  refreshKey?: number;
}

export function ConversationAttachmentsPanel({
  conversationId,
  onOpenAttachment,
  onJumpToMessage,
  isOpen,
  onClose,
  refreshKey,
}: ConversationAttachmentsPanelProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && conversationId) {
      loadAttachments();
    }
  }, [isOpen, conversationId, refreshKey]);

  const loadAttachments = async () => {
    if (!conversationId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await api.getConversationAttachments(conversationId);
      setAttachments(data.attachments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attachments');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile Only */}
      <>
        {/* Mobile Backdrop */}
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />

        {/* Mobile Panel */}
        <div className="lg:hidden fixed inset-y-0 right-0 w-80 max-w-[85vw] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-xl z-50 flex flex-col animate-slide-in-right">
          {/* Header with close button */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-indigo-500 to-purple-600">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <FileText className="w-5 h-5" />
              附件列表
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors cursor-pointer"
              aria-label="关闭附件列表"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content - Mobile */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-500 text-sm">
                {error}
              </div>
            ) : attachments.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">
                暂无附件
              </div>
            ) : (
              <div className="space-y-2">
                {attachments.map((attachment) => (
                  <button
                    key={attachment.attachment_id}
                    onClick={() => onOpenAttachment(attachment)}
                    className={cn(
                      'w-full p-4 rounded-xl border bg-white dark:bg-slate-800',
                      'border-slate-200 dark:border-slate-700',
                      'hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md',
                      'transition-all duration-200 cursor-pointer text-left'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <FileText className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                          {attachment.filename}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {attachment.uploaded_by} · {new Date(attachment.uploaded_at).toLocaleString('zh-CN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false
                          })}
                        </div>
                      </div>
                      {attachment.message_id && onJumpToMessage && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onJumpToMessage(attachment.message_id!);
                          }}
                          className="flex-shrink-0 p-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 transition-colors cursor-pointer"
                          title="跳转到消息"
                        >
                          <Crosshair className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </>

      {/* Desktop Only - Content Only (No Container) */}
      <>
        {/* Header */}
        <div className="hidden lg:flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-500 to-purple-600">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <FileText className="w-5 h-5" />
            附件列表
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="关闭附件列表"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="hidden lg:block overflow-y-auto scrollbar-thin p-4" style={{ height: 'calc(100% - 73px)' }}>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500 text-sm">
              {error}
            </div>
          ) : attachments.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              暂无附件
            </div>
          ) : (
            <div className="space-y-2">
              {attachments.map((attachment) => (
                <button
                  key={attachment.attachment_id}
                  onClick={() => onOpenAttachment(attachment)}
                  className="w-full p-4 rounded-xl border bg-white border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all duration-200 cursor-pointer text-left"
                >
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 truncate">
                        {attachment.filename}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {attachment.uploaded_by} · {new Date(attachment.uploaded_at).toLocaleString('zh-CN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: false
                        })}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </>
    </>
  );
}
