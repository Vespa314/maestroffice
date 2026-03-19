import { useState, useRef, useEffect } from 'react';
import { MessageSquare, FileText, X, Loader2, Crosshair, Upload } from 'lucide-react';
import { ConversationHeader } from './ConversationHeader';
import { MessageList } from './MessageList';
import { MessageInput, MessageInputRef } from './MessageInput';
import { ConversationRightSidebar } from './ConversationRightSidebar';
import { ConversationAttachmentsPanel } from './ConversationAttachmentsPanel';
import { AttachmentViewerModal } from './AttachmentViewerModal';
import { UploadFileModal } from './UploadFileModal';
import { CreateTextAttachmentModal } from './CreateTextAttachmentModal';
import { RenameFileDialogModal } from './RenameFileDialogModal';
import { api } from '@/lib/api';
import type { Message, Attachment } from '@/types';
import { isImageMime } from '@/types';

// Attachments Panel Content Component for Desktop
interface AttachmentsPanelContentProps {
  conversationId: string | null;
  onOpenAttachment: (attachment: Attachment) => void;
  onJumpToMessage?: (messageId: string) => void;
  onClose: () => void;
  refreshKey?: number;
}

function AttachmentsPanelContent({ conversationId, onOpenAttachment, onJumpToMessage, onClose, refreshKey }: AttachmentsPanelContentProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageThumbnails, setImageThumbnails] = useState<Record<string, string>>({});

  // 清理 blob URLs
  useEffect(() => {
    return () => {
      Object.values(imageThumbnails).forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [imageThumbnails]);

  useEffect(() => {
    loadAttachments();
  }, [conversationId, refreshKey]);

  const loadAttachments = async () => {
    if (!conversationId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await api.getConversationAttachments(conversationId);
      setAttachments(data.attachments);

      // 加载图片缩略图
      const newThumbnails: Record<string, string> = {};
      for (const attachment of data.attachments) {
        if (isImageMime(attachment.mime_type)) {
          try {
            const response = await fetch(`/api/attachments/${attachment.attachment_id}/download`, {
              headers: api.getHeaders()
            });
            if (response.ok) {
              const blob = await response.blob();
              // 缩略图使用较小尺寸
              const img = new Image();
              img.src = URL.createObjectURL(blob);
              // 等待图片加载以获取尺寸
              await new Promise<void>((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              });
              newThumbnails[attachment.attachment_id] = img.src;
            }
          } catch (err) {
            console.error('Failed to load thumbnail:', err);
          }
        }
      }
      setImageThumbnails(newThumbnails);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attachments');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-500 to-purple-600">
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
          <div className="text-center py-8 text-slate-500 text-sm">
            暂无附件
          </div>
        ) : (
          <div className="space-y-2">
            {attachments.map((attachment) => {
              const thumbnailUrl = imageThumbnails[attachment.attachment_id];
              return (
                <button
                  key={attachment.attachment_id}
                  onClick={() => onOpenAttachment(attachment)}
                  className="w-full p-3 rounded-xl border bg-white border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all duration-200 cursor-pointer text-left"
                >
                  <div className="flex items-start gap-3">
                    {/* Thumbnail or icon */}
                    {thumbnailUrl ? (
                      <img
                        src={thumbnailUrl}
                        alt={attachment.filename}
                        className="w-12 h-12 object-cover rounded-lg flex-shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <FileText className="w-12 h-12 text-indigo-500 flex-shrink-0" />
                    )}
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
                        className="flex-shrink-0 p-1.5 rounded-lg hover:bg-indigo-100 text-indigo-500 transition-colors cursor-pointer"
                        title="跳转到消息"
                      >
                        <Crosshair className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

interface DragState {
  isDragging: boolean;
  dragCounter: number;
}

interface ChatPanelProps {
  conversationId: string | null;
  title: string;
  announcement: string;
  members: string[];
  messages: Message[];
  loading: boolean;
  currentUsername: string | null;
  onSendMessage: (content: string, attachmentIds: string[]) => Promise<void>;
  onRefresh: () => void;
  mobileRightSidebarOpen?: boolean;
  onCloseMobileRightSidebar?: () => void;
  userWorkingStatus?: Record<string, boolean>;
}

export function ChatPanel({
  conversationId,
  title,
  announcement,
  members,
  messages,
  currentUsername,
  onSendMessage,
  onRefresh,
  mobileRightSidebarOpen = false,
  onCloseMobileRightSidebar,
  userWorkingStatus = {},
}: ChatPanelProps) {
  const [showAttachmentsPanel, setShowAttachmentsPanel] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const [showUploadFileModal, setShowUploadFileModal] = useState(false);
  const [showCreateTextModal, setShowCreateTextModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [attachmentsRefreshKey, setAttachmentsRefreshKey] = useState(0);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState>({ isDragging: false, dragCounter: 0 });
  const messageInputRef = useRef<MessageInputRef>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [pendingDroppedFile, setPendingDroppedFile] = useState<File | null>(null);

  // Handle drag and drop for file upload
  useEffect(() => {
    const container = dropZoneRef.current;
    if (!container) return;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragState(prev => ({ isDragging: true, dragCounter: prev.dragCounter + 1 }));
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragState(prev => {
        const newCounter = prev.dragCounter - 1;
        if (newCounter === 0) {
          return { isDragging: false, dragCounter: 0 };
        }
        return { isDragging: true, dragCounter: newCounter };
      });
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragState({ isDragging: false, dragCounter: 0 });

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        // 只支持单文件拖放重命名
        const file = files[0];
        setPendingDroppedFile(file);
        setShowRenameModal(true);
      }
    };

    container.addEventListener('dragenter', handleDragEnter);
    container.addEventListener('dragleave', handleDragLeave);
    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('drop', handleDrop);

    return () => {
      container.removeEventListener('dragenter', handleDragEnter);
      container.removeEventListener('dragleave', handleDragLeave);
      container.removeEventListener('dragover', handleDragOver);
      container.removeEventListener('drop', handleDrop);
    };
  }, []);

  // 处理拖放文件重命名确认
  const handleDropRenameConfirm = (newFileName: string) => {
    if (pendingDroppedFile) {
      // 创建新文件对象，使用新文件名
      const renamedFile = new File([pendingDroppedFile], newFileName, {
        type: pendingDroppedFile.type
      });

      // 这里我们暂时不支持直接添加到 MessageInput 的 pendingFiles
      // 用户可以通过"上传文件"按钮选择文件
      // 或者通过粘贴来添加
      console.log('Dropped file renamed:', renamedFile);
    }
    setPendingDroppedFile(null);
  };

  const handleOpenAttachment = async (attachmentOrId: Attachment | string) => {
    try {
      // Handle both Attachment object and attachmentId string
      const attachmentId = typeof attachmentOrId === 'string' ? attachmentOrId : attachmentOrId.attachment_id;
      const data = await api.getAttachment(attachmentId);
      setSelectedAttachment(data);
    } catch (err) {
      // Failed to load attachment
    }
  };

  // 延迟上传：点击发送时才真正上传文件和创建文本附件
  const handleSendMessage = async (content: string, files: File[], textAttachments: { filename: string; content: string }[]) => {
    setSending(true);
    try {
      const attachmentIds: string[] = [];

      // 上传所有文件
      for (const file of files) {
        const data = await api.uploadFile(file);
        attachmentIds.push(data.attachment_id);
      }

      // 创建所有文本附件
      for (const textAtt of textAttachments) {
        const data = await api.createTextAttachment(textAtt.filename, textAtt.content);
        attachmentIds.push(data.attachment_id);
      }

      // 发送消息
      await onSendMessage(content, attachmentIds);

      // If message has attachments and attachments panel is open, refresh the panel
      if (attachmentIds.length > 0 && showAttachmentsPanel) {
        setAttachmentsRefreshKey(prev => prev + 1);
      }
    } finally {
      setSending(false);
    }
  };

  const handleQuoteMessage = (quoteText: string) => {
    if (messageInputRef.current) {
      messageInputRef.current.insertText(quoteText);
      messageInputRef.current.focus();
    }
  };

  const handleJumpToMessage = (messageId: string) => {
    setHighlightMessageId(messageId);
  };

  if (!conversationId) {
    return (
      <div
        className="flex-1 flex items-center justify-center overflow-auto relative"
        style={{
          backgroundImage: 'url(/logo-512.png)',
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50/90 to-blue-50/90" />
        <div className="relative z-10 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
            <MessageSquare className="w-10 h-10 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            选择一个对话开始聊天
          </h2>
          <p className="text-sm text-slate-500">
            从左侧列表中选择一个对话
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={dropZoneRef}
        className={`flex-1 flex overflow-hidden relative transition-colors duration-200 ${
          dragState.isDragging ? 'bg-blue-50' : ''
        }`}
      >
        {dragState.isDragging && (
          <div className="absolute inset-0 z-50 bg-blue-500/10 flex items-center justify-center border-4 border-dashed border-blue-500 m-4 rounded-lg">
            <div className="text-center">
              <Upload className="w-16 h-16 mx-auto mb-4 text-blue-500" />
              <p className="text-xl font-medium text-blue-700">拖放文件到此处上传</p>
            </div>
          </div>
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <ConversationHeader
            conversationId={conversationId}
            title={title}
          />

          {/* Messages */}
          <MessageList
            messages={messages}
            currentUsername={currentUsername}
            onOpenAttachment={handleOpenAttachment}
            onQuoteMessage={handleQuoteMessage}
            highlightMessageId={highlightMessageId}
          />

          {/* Input */}
          <MessageInput
            ref={messageInputRef}
            onSendMessage={handleSendMessage}
            uploading={sending}
            onShowUploadFileModal={() => setShowUploadFileModal(true)}
            onShowCreateTextModal={() => setShowCreateTextModal(true)}
            onShowAttachmentsPanel={() => setShowAttachmentsPanel(!showAttachmentsPanel)}
            members={members}
            currentUsername={currentUsername}
          />
        </div>

        {/* Right Panel Container - PC Only */}
        <div className="hidden lg:flex">
          {/* Right Sidebar */}
          <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full overflow-hidden">
            <ConversationRightSidebar
              conversationId={conversationId}
              title={title}
              announcement={announcement}
              members={members}
              currentUsername={currentUsername}
              onRefresh={onRefresh}
              userWorkingStatus={userWorkingStatus}
            />
          </div>

          {/* Attachments Panel - PC Only */}
          {showAttachmentsPanel && (
            <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full overflow-hidden animate-slide-in">
              <AttachmentsPanelContent
                conversationId={conversationId}
                onOpenAttachment={(attachment) => setSelectedAttachment(attachment)}
                onJumpToMessage={handleJumpToMessage}
                onClose={() => setShowAttachmentsPanel(false)}
                refreshKey={attachmentsRefreshKey}
              />
            </div>
          )}
        </div>

        {/* Mobile Right Sidebar */}
        <div className={`
          fixed lg:hidden right-0 top-[56px] bottom-0 z-50
          transition-transform duration-300 ease-in-out
          ${mobileRightSidebarOpen ? 'translate-x-0' : 'translate-x-full'}
        `}>
          <div className="w-80 max-w-[85vw] bg-white border-l border-gray-200 flex flex-col h-full">
            <ConversationRightSidebar
              conversationId={conversationId}
              title={title}
              announcement={announcement}
              members={members}
              currentUsername={currentUsername}
              onRefresh={onRefresh}
              onClose={onCloseMobileRightSidebar}
              userWorkingStatus={userWorkingStatus}
            />
          </div>
        </div>

        {/* Mobile Right Sidebar Overlay */}
        {mobileRightSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={onCloseMobileRightSidebar}
          />
        )}
      </div>

      {/* Mobile Only Attachments Panel */}
      <div className="lg:hidden">
        <ConversationAttachmentsPanel
          conversationId={conversationId}
          onOpenAttachment={(attachment) => setSelectedAttachment(attachment)}
          onJumpToMessage={handleJumpToMessage}
          isOpen={showAttachmentsPanel}
          onClose={() => setShowAttachmentsPanel(false)}
          refreshKey={attachmentsRefreshKey}
        />
      </div>

      {/* Attachment Viewer */}
      <AttachmentViewerModal
        isOpen={selectedAttachment !== null}
        onClose={() => setSelectedAttachment(null)}
        attachment={selectedAttachment}
      />

      {/* Upload File Modal */}
      <UploadFileModal
        isOpen={showUploadFileModal}
        onClose={() => setShowUploadFileModal(false)}
        onAddFiles={(files) => {
          // 添加文件到待发送列表（不立即发送）
          for (const file of files) {
            messageInputRef.current?.addFileAttachment(file);
          }
          setShowUploadFileModal(false);
        }}
      />

      {/* Create Text Attachment Modal */}
      <CreateTextAttachmentModal
        isOpen={showCreateTextModal}
        onClose={() => setShowCreateTextModal(false)}
        onAddAttachments={async (attachments) => {
          // 添加文本附件到待发送列表（不立即发送）
          for (const attachment of attachments) {
            messageInputRef.current?.addTextAttachment(attachment.filename, attachment.content);
          }
          setShowCreateTextModal(false);
        }}
      />

      {/* Rename File Modal for dropped files */}
      {showRenameModal && pendingDroppedFile && (
        <RenameFileDialogModal
          isOpen={showRenameModal}
          fileName={pendingDroppedFile.name}
          onClose={() => {
            setShowRenameModal(false);
            setPendingDroppedFile(null);
          }}
          onConfirm={handleDropRenameConfirm}
        />
      )}
    </>
  );
}
