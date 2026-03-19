import { useEffect, useRef, useState } from 'react';
import { MessageCircle, FileText, Copy, Image as ImageIcon, FileArchive, Film, Music } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Avatar } from './Avatar';
import { MessageSourceModal } from './MessageSourceModal';
import { cn } from '@/lib/utils';
import type { Message } from '@/types';
import { isTextMime, isImageMime, isVideoMime, isAudioMime } from '@/types';
import { api } from '@/lib/api';

const getAttachmentIcon = (mime_type: string) => {
  if (isImageMime(mime_type)) {
    return <ImageIcon className="w-3.5 h-3.5 flex-shrink-0 text-green-500" />;
  } else if (isVideoMime(mime_type)) {
    return <Film className="w-3.5 h-3.5 flex-shrink-0 text-purple-500" />;
  } else if (isAudioMime(mime_type)) {
    return <Music className="w-3.5 h-3.5 flex-shrink-0 text-pink-500" />;
  } else if (isTextMime(mime_type)) {
    return <FileText className="w-3.5 h-3.5 flex-shrink-0 text-blue-500" />;
  } else {
    return <FileArchive className="w-3.5 h-3.5 flex-shrink-0 text-orange-500" />;
  }
};

interface MessageListProps {
  messages: Message[];
  currentUsername: string | null;
  onOpenAttachment: (attachmentId: string) => void;
  onQuoteMessage?: (content: string) => void;
  highlightMessageId?: string | null;
}

export function MessageList({ messages, currentUsername, onOpenAttachment, onQuoteMessage, highlightMessageId }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [contextMenuMessage, setContextMenuMessage] = useState<Message | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  // 存储图片缩略图的 blob URL
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

  // 获取图片缩略图
  useEffect(() => {
    const loadThumbnails = async () => {
      const newThumbnails: Record<string, string> = {};

      for (const message of messages) {
        for (const attachment of message.attachments) {
          if (attachment.mime_type?.startsWith('image/') && !imageThumbnails[attachment.attachment_id]) {
            try {
              const response = await fetch(`/api/attachments/${attachment.attachment_id}/download`, {
                headers: api.getHeaders()
              });
              if (response.ok) {
                const blob = await response.blob();
                newThumbnails[attachment.attachment_id] = URL.createObjectURL(blob);
              }
            } catch (err) {
              console.error('Failed to load thumbnail:', err);
            }
          }
        }
      }

      if (Object.keys(newThumbnails).length > 0) {
        setImageThumbnails(prev => ({ ...prev, ...newThumbnails }));
      }
    };

    loadThumbnails();
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  // Handle message highlighting
  useEffect(() => {
    if (highlightMessageId) {
      setHighlightedMessageId(highlightMessageId);
      // Scroll to the highlighted message
      setTimeout(() => {
        const messageElement = document.getElementById(`message-${highlightMessageId}`);
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Remove highlight after animation
          setTimeout(() => {
            setHighlightedMessageId(null);
          }, 2000);
        }
      }, 100);
    }
  }, [highlightMessageId]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenuMessage(null);
      setContextMenuPosition(null);
    };

    if (contextMenuMessage) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenuMessage]);

  // Handle quote message
  const handleQuoteMessage = (message: Message) => {
    if (!onQuoteMessage || !message.content) return;

    const isOwn = message.sender === currentUsername;
    const truncatedContent = message.content.length > 30
      ? message.content.substring(0, 30) + '...'
      : message.content;
    const quoteText = isOwn
      ? `${truncatedContent}\n------------\n`
      : `${truncatedContent}\n------------\n@${message.sender} `;
    onQuoteMessage(quoteText);
    setContextMenuMessage(null);
    setContextMenuPosition(null);
  };

  // Handle view original message
  const handleViewOriginal = (message: Message) => {
    setSelectedMessage(message);
    setContextMenuMessage(null);
    setContextMenuPosition(null);
  };

  // Handle copy original message
  const handleCopyOriginal = (message: Message) => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
    }
    setContextMenuMessage(null);
    setContextMenuPosition(null);
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-lg font-medium text-slate-900 mb-1">开始对话</p>
          <p className="text-sm text-slate-500">发送第一条消息</p>
        </div>
      </div>
    );
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) + ' ' +
           date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
    <div ref={messagesContainerRef} className="flex-1 overflow-y-auto scrollbar-thin p-3 sm:p-6 space-y-3 sm:space-y-4 bg-gradient-to-br from-gray-50 to-blue-50/50">
      {messages.map((message) => {
        const isOwn = message.sender === currentUsername;
        const isHighlighted = message.message_id === highlightedMessageId;

        return (
          <div
            id={`message-${message.message_id}`}
            key={message.message_id}
            className={cn(
              'flex gap-2 sm:gap-3 group transition-all duration-300',
              // Mobile: avatar above message (column), Desktop: side-by-side (row)
              'flex-col sm:flex-row',
              isOwn && 'sm:flex-row-reverse items-end sm:items-start',
              !isOwn && 'items-start sm:items-start',
              isHighlighted && 'bg-yellow-100 dark:bg-yellow-900/30 -mx-2 px-2 py-2 rounded-lg scale-[1.02]'
            )}
          >
            {/* Avatar */}
            <div className={cn(
              "flex w-full sm:w-auto",
              isOwn ? 'justify-end sm:justify-auto' : 'justify-start sm:justify-auto'
            )}>
              <Avatar
                username={message.sender}
                size="md"
                className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                onDoubleClick={() => {
                  // Quote message on double click avatar
                  if (onQuoteMessage && message.content) {
                    const isOwn = message.sender === currentUsername;
                    const truncatedContent = message.content.length > 30
                      ? message.content.substring(0, 30) + '...'
                      : message.content;
                    const quoteText = isOwn
                      ? `${truncatedContent}\n------------\n`
                      : `${truncatedContent}\n------------\n@${message.sender} `;
                    onQuoteMessage(quoteText);
                  }
                }}
              />
            </div>

            {/* Message Bubble */}
            <div className={cn('flex flex-col max-w-[90%] sm:max-w-[70%] w-full sm:w-auto', isOwn ? 'items-end' : 'items-start')}>
              {/* Bubble with modern chat style (inspired by iMessage/Telegram) */}
              <div
                className={cn(
                  'relative px-4 py-2.5 shadow-sm transition-all duration-200 cursor-pointer hover:shadow-md',
                  // Bubble shape - consistent rounded corners like iMessage
                  isOwn
                    ? 'bg-blue-500 text-white rounded-2xl'
                    : 'bg-white text-slate-800 rounded-2xl border border-gray-200/60 shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
                )}
                onDoubleClick={() => {
                  // View original message on double click
                  setSelectedMessage(message);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenuMessage(message);
                  setContextMenuPosition({ x: e.clientX, y: e.clientY });
                }}
              >
                {/* Content */}
                {message.content && (
                  <div className={cn(
                    "max-w-none text-sm leading-relaxed",
                    isOwn
                      ? 'prose prose-invert prose-sm max-w-none [&_a]:text-blue-200 [&_a]:hover:text-white [&_p]:text-white [&_strong]:text-white [&_em]:text-white [&_code]:text-white [&_pre]:text-white [&_li]:text-white [&_ul]:text-white [&_ol]:text-white [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_h4]:text-white [&_h5]:text-white [&_h6]:text-white'
                      : 'prose prose-slate prose-sm max-w-none'
                  )}>
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                      {message.content.replace(/\\n/g, '\n')}
                    </ReactMarkdown>
                  </div>
                )}

                {/* Attachments with thumbnails */}
                {message.attachments && message.attachments.length > 0 && (
                  <div className={cn(
                    'mt-2 pt-2 flex flex-wrap gap-2',
                    isOwn ? 'border-t border-white/10' : 'border-t border-gray-100'
                  )}>
                    {message.attachments.map((attachment) => {
                      const isImage = attachment.mime_type?.startsWith('image/');
                      const thumbnailUrl = imageThumbnails[attachment.attachment_id];
                      return (
                        <button
                          key={attachment.attachment_id}
                          onClick={() => onOpenAttachment(attachment.attachment_id)}
                          className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-200 cursor-pointer text-xs font-medium max-w-[180px]',
                            isOwn
                              ? 'bg-white/15 hover:bg-white/25 text-white'
                              : 'bg-gray-50 hover:bg-gray-100 text-slate-600'
                          )}
                          title={attachment.filename}
                        >
                          {isImage && thumbnailUrl ? (
                            <>
                              <img
                                src={thumbnailUrl}
                                alt={attachment.filename}
                                className="w-6 h-6 object-cover rounded flex-shrink-0"
                                loading="lazy"
                              />
                              <span className="truncate">{attachment.filename}</span>
                            </>
                          ) : (
                            <>
                              {getAttachmentIcon(attachment.mime_type)}
                              <span className="truncate">{attachment.filename}</span>
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Timestamp - below bubble like Telegram/iMessage */}
              <div className={cn('text-[11px] text-slate-400 mt-1 px-1', isOwn ? 'text-right' : 'text-left')}>
                {formatTime(message.created_at)}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>

    {/* Message Source Modal */}
    {selectedMessage && (
      <MessageSourceModal
        isOpen={selectedMessage !== null}
        onClose={() => setSelectedMessage(null)}
        content={selectedMessage.content || ''}
        sender={selectedMessage.sender}
        createdAt={selectedMessage.created_at}
      />
    )}

    {/* Context Menu */}
    {contextMenuMessage && contextMenuPosition && (
      <div
        className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[160px]"
        style={{ left: contextMenuPosition.x, top: contextMenuPosition.y }}
        onClick={(e) => e.stopPropagation()}
      >
        {onQuoteMessage && contextMenuMessage.content && (
          <button
            onClick={() => handleQuoteMessage(contextMenuMessage)}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            引用消息
          </button>
        )}
        <button
          onClick={() => handleViewOriginal(contextMenuMessage)}
          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
        >
          <FileText className="w-4 h-4" />
          查看原文
        </button>
        <button
          onClick={() => handleCopyOriginal(contextMenuMessage)}
          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
        >
          <Copy className="w-4 h-4" />
          复制原文
        </button>
      </div>
    )}
  </>
  );
}
