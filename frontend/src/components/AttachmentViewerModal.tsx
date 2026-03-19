import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { api } from '@/lib/api';
import { Check, Copy, Loader2, User, Clock, Download, Image as ImageIcon, FileText, FileArchive } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { formatTimestamp } from '@/lib/utils';
import { isTextMime, isImageMime, isVideoMime, isAudioMime } from '@/types';
import type { Attachment } from '@/types';

interface AttachmentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  attachment: Attachment | null;
}

export function AttachmentViewerModal({ isOpen, onClose, attachment }: AttachmentViewerModalProps) {
  const [data, setData] = useState<{
    content?: string;
    blob_url?: string;
    file_size?: number;
    mime_type?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Cleanup blob URL when modal closes or component unmounts
  useEffect(() => {
    return () => {
      if (data?.blob_url) {
        URL.revokeObjectURL(data.blob_url);
      }
    };
  }, [data?.blob_url]);

  useEffect(() => {
    if (isOpen && attachment) {
      loadAttachment();
    } else {
      setData(null);
      setError(null);
    }
  }, [isOpen, attachment]);

  const loadAttachment = async () => {
    if (!attachment) return;

    try {
      setLoading(true);
      setError(null);
      const responseData = await api.getAttachment(attachment.attachment_id);
      const mime_type = responseData.mime_type || attachment.mime_type;

      // For text files, use the content directly
      if (isTextMime(mime_type) && responseData.content !== undefined) {
        setData({
          content: responseData.content,
          file_size: responseData.file_size,
          mime_type
        });
      } else {
        // For binary files, fetch the file and create a blob URL
        const response = await fetch(`/api/attachments/${attachment.attachment_id}/download`, {
          headers: api.getHeaders()
        });

        if (!response.ok) {
          throw new Error('Failed to load file');
        }

        const blob = await response.blob();
        const blob_url = URL.createObjectURL(blob);

        setData({
          blob_url,
          file_size: blob.size,
          mime_type
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attachment');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (data?.content) {
      try {
        await navigator.clipboard.writeText(data.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const handleDownload = () => {
    if (!attachment || !data?.blob_url) return;

    const a = document.createElement('a');
    a.href = data.blob_url;
    a.download = attachment.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (mime_type: string) => {
    if (isImageMime(mime_type)) {
      return <ImageIcon className="w-5 h-5 text-green-500" />;
    } else if (isTextMime(mime_type)) {
      return <FileText className="w-5 h-5 text-blue-500" />;
    } else {
      return <FileArchive className="w-5 h-5 text-orange-500" />;
    }
  };

  const renderContent = () => {
    if (!attachment) {
      return (
        <div className="flex-1 flex items-center justify-center text-text-muted">
          此附件无法预览
        </div>
      );
    }

    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-secondary" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex-1 flex items-center justify-center text-red-500">
          {error}
        </div>
      );
    }

    if (!data) {
      return (
        <div className="flex-1 flex items-center justify-center text-text-muted">
          此附件无法预览
        </div>
      );
    }

    const mime_type = data.mime_type || attachment.mime_type;

    // Text content - render Markdown
    if (isTextMime(mime_type) && data.content !== undefined) {
      return (
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
          <div className="markdown-body prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
              {data.content}
            </ReactMarkdown>
          </div>
        </div>
      );
    }

    // Image - render preview
    if (isImageMime(mime_type) && data.blob_url) {
      return (
        <div className="flex-1 flex items-center justify-center p-4 bg-black/5 overflow-hidden">
          <img
            src={data.blob_url}
            alt={attachment!.filename}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      );
    }

    // Video - render video player
    if (isVideoMime(mime_type) && data.blob_url) {
      return (
        <div className="flex-1 flex items-center justify-center p-4">
          <video
            src={data.blob_url}
            controls
            className="max-w-full max-h-full rounded-lg"
          />
        </div>
      );
    }

    // Audio - render audio player
    if (isAudioMime(mime_type) && data.blob_url) {
      return (
        <div className="flex-1 flex items-center justify-center p-4">
          <audio
            src={data.blob_url}
            controls
            className="w-full max-w-md"
          />
        </div>
      );
    }

    // Other binary files - show download button
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4">
        {getFileIcon(mime_type)}
        <div className="text-center">
          <p className="text-lg font-medium text-text-primary mb-2">
            {attachment!.filename}
          </p>
          {data.file_size && (
            <p className="text-sm text-text-muted">
              文件大小: {formatFileSize(data.file_size)}
            </p>
          )}
        </div>
        <button
          onClick={handleDownload}
          className="btn btn-primary flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          下载文件
        </button>
      </div>
    );
  };

  if (!attachment) return null;

  const mime_type = data?.mime_type || attachment.mime_type;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={attachment.filename} size="full">
      <div className="space-y-4">
        {/* Attachment Info */}
        <div className="flex items-center justify-between gap-4 text-sm text-text-secondary p-3 bg-primary-light/50 rounded-lg">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {getFileIcon(mime_type)}
              <span className="font-medium text-text-primary">{attachment.filename}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>上传者: {attachment.uploaded_by}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{formatTimestamp(attachment.uploaded_at)}</span>
            </div>
            {data?.file_size && (
              <div className="flex items-center gap-2">
                <FileArchive className="w-4 h-4" />
                <span>{formatFileSize(data.file_size)}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {data?.blob_url && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded transition-colors hover:bg-primary-light text-text-primary hover:text-secondary cursor-pointer"
                title="下载文件"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            {data?.content && (
              <button
                onClick={handleCopy}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded transition-colors hover:bg-primary-light text-text-primary hover:text-secondary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                title="复制内容"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>复制</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="border border-border rounded-lg bg-primary-light/50 h-[60vh] flex flex-col overflow-hidden">
          {renderContent()}
        </div>
      </div>
    </Modal>
  );
}
