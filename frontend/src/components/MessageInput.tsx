import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Send, Paperclip, Files, Loader2, AtSign, Users, X } from 'lucide-react';
import { RenameFileDialogModal } from './RenameFileDialogModal';

type SendKeyMode = 'enter' | 'ctrlEnter' | 'shiftEnter';

const SEND_KEY_MODE_STORAGE_KEY = 'messageSendKeyMode';

interface PendingAttachment {
  id: string;
  filename: string;
  file?: File;
  content?: string; // 文本附件内容
  preview?: string; // 图片缩略图
}

interface MessageInputProps {
  onSendMessage: (content: string, files: File[], textAttachments: { filename: string; content: string }[]) => Promise<void>;
  uploading: boolean;
  onShowUploadFileModal?: () => void;
  onShowCreateTextModal?: () => void;
  onShowAttachmentsPanel?: () => void;
  members?: string[];
  currentUsername?: string | null;
}

export interface MessageInputRef {
  insertText: (text: string) => void;
  focus: () => void;
  addTextAttachment: (filename: string, content: string) => void;
  addFileAttachment: (file: File) => void;
}

export const MessageInput = forwardRef<MessageInputRef, MessageInputProps>(({
  onSendMessage,
  uploading,
  onShowUploadFileModal,
  onShowCreateTextModal,
  onShowAttachmentsPanel,
  members = [],
  currentUsername,
}, ref) => {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStartPos, setMentionStartPos] = useState(0);
  const popupRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  // 待上传的文件列表（客户端暂存，还没上传）
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([]);
  // 重命名弹窗状态
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [pendingFileToRename, setPendingFileToRename] = useState<File | null>(null);
  // 拖拽状态
  const [isDragging, setIsDragging] = useState(false);
  // 发送快捷键模式
  const [sendKeyMode, setSendKeyMode] = useState<SendKeyMode>(() => {
    const stored = localStorage.getItem(SEND_KEY_MODE_STORAGE_KEY);
    if (stored === 'ctrlEnter' || stored === 'shiftEnter') {
      return stored;
    }
    return 'enter';
  });

  // 监听 localStorage 变化，实时更新设置
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
    window.addEventListener('localstorage_changed', handleStorageChange as any);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('localstorage_changed', handleStorageChange as any);
    };
  }, []);

  // 暴露给父组件的方法，用于添加文本附件和文件附件
  useImperativeHandle(ref, () => ({
    insertText: (text: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = content.substring(0, start) + text + content.substring(end);

      setContent(newValue);

      // Set cursor position after inserted text, focus, and adjust height
      setTimeout(() => {
        textarea.focus();
        const newPosition = start + text.length;
        textarea.setSelectionRange(newPosition, newPosition);

        // Auto-adjust height
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 360) + 'px';
      }, 0);
    },
    focus: () => {
      textareaRef.current?.focus();
    },
    addTextAttachment: (filename: string, content: string) => {
      const id = Math.random().toString(36).substring(2, 15);
      setPendingFiles(prev => [...prev, {
        id,
        filename,
        content
      }]);
    },
    addFileAttachment: (file: File) => {
      addPendingFile(file);
    }
  }));

  // 检测是否为移动端
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Filter members that can be mentioned (exclude current user)
  const mentionableMembers = members.filter(m => m !== currentUsername);

  // Always add @all option at the top
  const mentionOptions = ['all', ...mentionableMembers];

  // Filter members based on query, but always keep @all visible
  const filteredMembers = mentionQuery
    ? mentionOptions.filter(m => m === 'all' || m.toLowerCase().includes(mentionQuery.toLowerCase()))
    : mentionOptions;

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        if (!showMentionPopup) return;
        const textarea = textareaRef.current;
        if (textarea && event.target !== textarea) {
          setShowMentionPopup(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMentionPopup]);

  // 创建图片预览
  const createImagePreview = (file: File): Promise<string | undefined> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        resolve(undefined);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target?.result as string);
      };
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(file);
    });
  };

  // 添加待上传文件
  const addPendingFile = (file: File, filename?: string) => {
    const id = Math.random().toString(36).substring(2, 15);
    const finalName = filename || file.name;

    // 如果是图片，创建缩略图
    createImagePreview(file).then(preview => {
      setPendingFiles(prev => [...prev, {
        id,
        filename: finalName,
        file,
        preview
      }]);
    });
  };

  // 删除待上传文件
  const removePendingFile = (id: string) => {
    setPendingFiles(prev => {
      const updated = prev.filter(f => f.id !== id);
      // 清理 blob URL
      const removed = prev.find(f => f.id === id);
      if (removed?.preview && removed.preview.startsWith('blob:')) {
        URL.revokeObjectURL(removed.preview);
      }
      return updated;
    });
  };

  // 处理拖拽进入
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  // 处理拖拽离开
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 只有离开整个组件区域时才隐藏拖拽提示
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (
      e.clientX <= rect.left ||
      e.clientX >= rect.right ||
      e.clientY <= rect.top ||
      e.clientY >= rect.bottom
    ) {
      setIsDragging(false);
    }
  };

  // 处理文件放下
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length === 0) return;

    // 直接添加到队列，不弹出重命名弹窗
    for (const file of files) {
      addPendingFile(file);
    }
  };

  // 处理粘贴事件
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }

    if (files.length > 0) {
      e.preventDefault();

      // 处理每个粘贴的文件
      for (const file of files) {
        // 弹出重命名弹窗
        setPendingFileToRename(file);
        setShowRenameModal(true);
      }
    }
  };

  // 确认重命名
  const handleRenameConfirm = (newFileName: string) => {
    if (pendingFileToRename) {
      addPendingFile(pendingFileToRename, newFileName);
    }
    setPendingFileToRename(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!content.trim() && pendingFiles.length === 0) || uploading) return;

    const files = pendingFiles.map(p => p.file).filter((f): f is File => f !== undefined);
    const textAttachments = pendingFiles.filter(p => p.content).map(p => ({ filename: p.filename, content: p.content! }));

    try {
      await onSendMessage(content.trim(), files, textAttachments);
      setContent('');
      setPendingFiles([]);
      // 清理所有预览 URL
      pendingFiles.forEach(p => {
        if (p.preview && p.preview.startsWith('blob:')) {
          URL.revokeObjectURL(p.preview);
        }
      });
      // Reset textarea height
      setTimeout(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.style.height = 'auto';
        }
      }, 0);
    } catch (err) {
      // Failed to send message
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionPopup) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % filteredMembers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + filteredMembers.length) % filteredMembers.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (filteredMembers.length > 0) {
          insertMention(filteredMembers[mentionIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentionPopup(false);
        setMentionQuery('');
      }
      return;
    }

    // 处理发送快捷键
    if (e.key === 'Enter') {
      if (sendKeyMode === 'enter' && !e.shiftKey) {
        // Enter 模式：直接发送（Shift+Enter 换行）
        e.preventDefault();
        handleSubmit(e);
      } else if (sendKeyMode === 'ctrlEnter' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        // Ctrl+Enter 模式：需要同时按下 Ctrl/Cmd 才发送（Enter 换行）
        e.preventDefault();
        handleSubmit(e);
      } else if (sendKeyMode === 'shiftEnter' && e.shiftKey) {
        // Shift+Enter 模式：需要同时按下 Shift 才发送（Enter 换行）
        e.preventDefault();
        handleSubmit(e);
      }
    }
  };

  const insertMention = (username: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const beforeMention = content.substring(0, mentionStartPos);
    const afterCursor = content.substring(textarea.selectionEnd);
    const newValue = beforeMention + `@${username} ` + afterCursor;

    setContent(newValue);
    setShowMentionPopup(false);
    setMentionQuery('');
    setMentionIndex(0);

    // Set cursor position after mention
    setTimeout(() => {
      const newPosition = mentionStartPos + username.length + 2; // +2 for "@" and space
      textarea.focus();
      textarea.setSelectionRange(newPosition, newPosition);
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 360) + 'px';
    }, 0);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setContent(newValue);

    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = newValue.substring(0, cursorPosition);

    // Check if we're typing a mention (look for @ before cursor)
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionStartPos(cursorPosition - mentionMatch[0].length);
      setMentionQuery(mentionMatch[1]);
      setMentionIndex(0);
      setShowMentionPopup(true);
    } else {
      setShowMentionPopup(false);
      setMentionQuery('');
    }
  };

  const canSend = content.trim() || pendingFiles.length > 0;

  return (
    <>
      <div
        className={`border-t border-gray-200 bg-white relative ${isDragging ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* 拖拽提示覆盖层 */}
        {isDragging && (
          <div className="absolute inset-2 sm:inset-4 bg-white/95 backdrop-blur-sm z-10 rounded-2xl border-2 border-dashed border-blue-400 flex flex-col items-center justify-center gap-3 pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
              <Paperclip className="w-8 h-8 text-blue-500" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-gray-700">拖放文件到这里</p>
              <p className="text-xs text-gray-400 mt-0.5">自动添加到附件列表</p>
            </div>
          </div>
        )}

        {/* Top Toolbar - Attachment Buttons */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-2 sm:py-3 border-b border-gray-100">
          <div className="flex items-center gap-2 overflow-x-auto">
            {onShowUploadFileModal && (
              <button
                type="button"
                onClick={onShowUploadFileModal}
                className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-slate-700 transition-all duration-200 cursor-pointer text-sm font-medium whitespace-nowrap"
                aria-label="上传文件"
                title="上传文件（支持图片、文档等所有类型）"
              >
                <Paperclip className="w-4 h-4" />
                <span className="hidden sm:inline">上传文件</span>
                <span className="sm:hidden">上传文件</span>
              </button>
            )}

            {onShowCreateTextModal && (
              <button
                type="button"
                onClick={onShowCreateTextModal}
                className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-slate-700 transition-all duration-200 cursor-pointer text-sm font-medium whitespace-nowrap"
                aria-label="创建文本附件"
                title="创建Markdown文本附件"
              >
                <Files className="w-4 h-4" />
                <span className="hidden sm:inline">创建文本附件</span>
                <span className="sm:hidden">创建文本</span>
              </button>
            )}
          </div>

          {onShowAttachmentsPanel && (
            <button
              type="button"
              onClick={onShowAttachmentsPanel}
              className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-slate-700 transition-all duration-200 cursor-pointer text-sm font-medium whitespace-nowrap"
              aria-label="查看所有附件"
              title="查看所有附件"
            >
              <Files className="w-4 h-4" />
              <span className="hidden sm:inline">查看所有附件</span>
              <span className="sm:hidden">所有附件</span>
            </button>
          )}
        </div>

        {/* Pending Files Preview with delete buttons */}
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 sm:px-6 py-2 sm:py-3 border-b border-gray-100">
            {pendingFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm group"
              >
                {/* Image thumbnail or file icon */}
                {file.preview ? (
                  <img
                    src={file.preview}
                    alt={file.filename}
                    className="w-10 h-10 object-cover rounded"
                  />
                ) : file.content ? (
                  <Files className="w-4 h-4 text-blue-600" />
                ) : (
                  <Paperclip className="w-4 h-4 text-blue-600" />
                )}
                <span className="text-slate-700 font-medium max-w-[150px] truncate">{file.filename}</span>
                <button
                  onClick={() => removePendingFile(file.id)}
                  className="ml-1 p-1 rounded-full hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                  title="移除文件"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input Area with Inline Send Button */}
        <div className="p-3 sm:p-6">
          <form onSubmit={handleSubmit} className="relative">
            <div className="relative flex items-end">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={isMobile ? "输入消息... (@ 提及成员)" : "输入消息... (Enter 发送, Shift+Enter 换行, @ 提及成员, 粘贴图片/文件可上传)"}
                className="w-full px-4 sm:px-5 py-3 sm:py-4 pr-14 sm:pr-16 bg-gray-50 border-2 border-gray-300 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 resize-none transition-all duration-200 text-sm leading-relaxed"
                rows={1}
                style={{ minHeight: '48px', maxHeight: '360px' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 360) + 'px';
                }}
              />

              {/* Mention Popup */}
              {showMentionPopup && filteredMembers.length > 0 && (
                <div
                  ref={popupRef}
                  className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50"
                >
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                    <AtSign className="w-4 h-4 text-gray-500" />
                    <span className="text-xs font-medium text-gray-600">选择要@的成员</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto py-1">
                    {filteredMembers.map((member, index) => (
                      <button
                        key={member}
                        type="button"
                        onClick={() => insertMention(member)}
                        className={`w-full px-4 py-2 text-left text-sm transition-colors cursor-pointer flex items-center gap-2 ${
                          index === mentionIndex
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                        onMouseEnter={() => setMentionIndex(index)}
                      >
                        {member === 'all' ? (
                          <>
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white flex-shrink-0">
                              <Users className="w-4 h-4" />
                            </div>
                            <span className="font-semibold">所有人</span>
                          </>
                        ) : (
                          <>
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                              {member.charAt(0).toUpperCase()}
                            </div>
                            <span className="truncate">{member}</span>
                          </>
                        )}
                        {index === mentionIndex && (
                          <span className="ml-auto text-xs text-blue-500">↵</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
                    使用 ↑↓ 选择，Enter 确认
                  </div>
                </div>
              )}

              {/* Send Button - Inline in bottom right */}
              <button
                type="submit"
                disabled={!canSend || uploading}
                className="absolute right-2 bottom-2 p-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-sm"
                aria-label="发送消息"
              >
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Rename File Modal */}
      {showRenameModal && pendingFileToRename && (
        <RenameFileDialogModal
          isOpen={showRenameModal}
          fileName={pendingFileToRename.name}
          onClose={() => {
            setShowRenameModal(false);
            setPendingFileToRename(null);
          }}
          onConfirm={handleRenameConfirm}
        />
      )}
    </>
  );
});
