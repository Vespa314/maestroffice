import { Modal } from './Modal';
import { Copy, Check, User, Clock } from 'lucide-react';
import { useState } from 'react';
import { formatTimestamp } from '@/lib/utils';

interface MessageSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  sender: string;
  createdAt: string;
}

export function MessageSourceModal({ isOpen, onClose, content, sender, createdAt }: MessageSourceModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Failed to copy
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="消息原文" size="lg">
      <div className="space-y-4">
        {/* Message Info */}
        <div className="flex items-center gap-4 text-sm text-text-secondary p-3 bg-primary-light/50 rounded-lg">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span>发送者: {sender}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>{formatTimestamp(createdAt)}</span>
          </div>
        </div>

        {/* Content - Readonly editor */}
        <div className="border border-border rounded-lg bg-primary-light/50 min-h-[40vh] max-h-[50vh] overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
            <pre className="whitespace-pre-wrap break-words font-mono text-sm text-text-primary leading-relaxed">
              {content}
            </pre>
          </div>
        </div>

        {/* Copy Button */}
        <div className="flex justify-end">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/90 text-white rounded-lg transition-colors cursor-pointer font-medium"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                已复制
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                复制原文
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
