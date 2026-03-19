import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Loader2, Clock, Timer, ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import { api } from '@/lib/api';
import Slider from '@mui/joy/Slider';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

interface TimelineEntry {
  id: number;
  timestamp: string;
  output: any;
  duration: number;
  start_time: string;
  end_time: string;
}

interface ContentItem {
  type: string;
  thinking?: string;
  text?: string;
  name?: string;
  input?: Record<string, any>;
}

interface OutputItem {
  subtype?: string;
  type?: string;
  message?: {
    content: ContentItem[];
  };
}

interface TimelineViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  zIndex?: number;
}

export function TimelineViewerModal({ isOpen, onClose, username, zIndex = 50 }: TimelineViewerModalProps) {
  const [currentEntry, setCurrentEntry] = useState<TimelineEntry | null>(null);
  const [total, setTotal] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showToolUse, setShowToolUse] = useState(() => {
    const stored = localStorage.getItem('showToolUse');
    return stored !== null ? JSON.parse(stored) : true;
  });
  const [showThinking, setShowThinking] = useState(() => {
    const stored = localStorage.getItem('showThinking');
    return stored !== null ? JSON.parse(stored) : true;
  });

  const parseOutput = (output: any): OutputItem[] => {
    if (typeof output === 'string') {
      try {
        return JSON.parse(output);
      } catch {
        return [];
      }
    }
    if (Array.isArray(output)) {
      return output;
    }
    return [];
  };

  const outputItems = currentEntry ? parseOutput(currentEntry.output) : [];

  const handlePrevious = async () => {
    if (currentIndex > 0) {
      await loadTimelineEntry(currentIndex - 1);
    }
  };

  const handleNext = async () => {
    if (currentIndex < total - 1) {
      await loadTimelineEntry(currentIndex + 1);
    }
  };

  const handleCopyJson = async () => {
    if (!currentEntry) return;
    const jsonStr = typeof currentEntry.output === 'string' ? currentEntry.output : JSON.stringify(currentEntry.output, null, 2);
    try {
      await navigator.clipboard.writeText(jsonStr);
      // Could add a toast notification here
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };


  // Scroll to top when index changes
  useEffect(() => {
    const scrollableDiv = document.querySelector('[data-scrollable="true"]');
    if (scrollableDiv) {
      scrollableDiv.scrollTop = 0;
    }
  }, [currentIndex]);

  useEffect(() => {
    if (isOpen && username) {
      // 重置初始加载状态
      setInitialLoading(true);
      // 使用 index=-1 获取最后一条和总条数
      loadTimelineEntry(-1);
    } else if (!isOpen) {
      // Modal 关闭时重置状态
      setCurrentEntry(null);
      setTotal(0);
      setCurrentIndex(0);
      setInitialLoading(true);
    }
  }, [isOpen, username]);

  useEffect(() => {
    localStorage.setItem('showToolUse', JSON.stringify(showToolUse));
  }, [showToolUse]);

  useEffect(() => {
    localStorage.setItem('showThinking', JSON.stringify(showThinking));
  }, [showThinking]);

  const loadTimelineEntry = async (index: number) => {
    try {
      // 只在初始加载时显示 loading
      if (currentEntry === null) {
        setInitialLoading(true);
      }

      const data = await api.getUserTimeline(username, index);

      // 处理返回的数据
      if ('entry' in data && 'total' in data) {
        setCurrentEntry(data.entry);
        setTotal(data.total);
        setCurrentIndex(data.index);
      } else if (Array.isArray(data)) {
        // 向后兼容：如果返回的是数组（没有传 index）
        if (data.length > 0) {
          setCurrentEntry(data[data.length - 1]);
          setTotal(data.length);
          setCurrentIndex(data.length - 1);
        } else {
          setCurrentEntry(null);
          setTotal(0);
          setCurrentIndex(0);
        }
      }
    } catch (err) {
      // Failed to load timeline entry
    } finally {
      setInitialLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch {
      return timestamp;
    }
  };

  const formatDuration = (duration?: number) => {
    if (duration === null || duration === undefined) return '';

    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);

    if (minutes > 0) {
      return `${minutes}分${seconds}秒`;
    }
    return `${seconds}秒`;
  };

  const renderContent = (content: ContentItem) => {
    if (content.type === 'thinking' && content.thinking) {
      return (
        <div key={content.type + content.thinking} className="text-blue-500">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} className="prose prose-sm max-w-none [&_a]:text-blue-400 [&_a]:hover:text-blue-600 [&_p]:text-blue-500 [&_strong]:text-blue-500 [&_em]:text-blue-500 [&_code]:text-blue-500 [&_pre]:text-blue-500 [&_li]:text-blue-500 [&_ul]:text-blue-500 [&_ol]:text-blue-500 [&_h1]:text-blue-500 [&_h2]:text-blue-500 [&_h3]:text-blue-500 [&_h4]:text-blue-500 [&_h5]:text-blue-500 [&_h6]:text-blue-500 [&_blockquote]:text-blue-500 [&_hr]:border-blue-500">
            {content.thinking}
          </ReactMarkdown>
        </div>
      );
    }
    if (content.type === 'text' && content.text) {
      return (
        <div key={content.type + content.text} className="text-black">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} className="prose prose-sm max-w-none">
            {content.text}
          </ReactMarkdown>
        </div>
      );
    }
    if (content.type === 'tool_use' && content.name) {
      if (!content.input) return null;

      // 特殊处理 TodoWrite
      if (content.name === 'TodoWrite' && content.input.todos) {
        const todos = content.input.todos;

        return (
          <div key={content.type + content.name}>
            <div className="text-orange-500 font-medium mb-3">
              调用工具 {content.name}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-border">
                <thead>
                  <tr className="bg-primary-light/30">
                    <th className="border border-border px-3 py-2 text-left text-sm font-medium text-text-primary">内容</th>
                    <th className="border border-border px-3 py-2 text-left text-sm font-medium text-text-primary">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {todos.map((todo: any, index: number) => (
                    <tr key={index} className="hover:bg-primary-light/20">
                      <td className="border border-border px-3 py-2 text-sm text-text-secondary">{todo.content}</td>
                      <td className="border border-border px-3 py-2 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          todo.status === 'completed' ? 'bg-green-100 text-green-800' :
                          todo.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          todo.status === 'pending' ? 'bg-gray-100 text-gray-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {todo.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      // 默认处理其他 tool_use
      const description = content.input.description;
      const otherEntries = Object.entries(content.input).filter(([key]) => key !== 'description');

      return (
        <div key={content.type + content.name}>
          <div className="text-orange-500 font-medium">
            调用工具 {content.name}
            {description && <span> ({description})</span>}
          </div>
          {otherEntries.length > 0 && (
            <ul className="text-orange-400 ml-4 list-disc list-inside">
              {otherEntries.map(([key, value]) => (
                <li key={key}>
                  {key}: {String(value)}
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }
    return null;
  };

  const renderItem = (item: OutputItem) => {
    // 如果有 item.subtype 且 item.subtype == "init"，不做任何处理
    if (item.subtype === 'init') {
      return null;
    }

    // 如果有 item.type 且 item.type = assistant
    if (item.type === 'assistant' && item.message?.content) {
      const contents = Array.isArray(item.message.content) ? item.message.content : [];

      // 根据勾选框状态过滤内容
      const filteredContents = contents.filter((content) => {
        if (content.type === 'thinking') {
          return showThinking;
        }
        if (content.type === 'tool_use') {
          return showToolUse;
        }
        return true;
      });

      // 如果过滤后没有内容，不渲染方框
      if (filteredContents.length === 0) {
        return null;
      }

      return (
        <div className="p-4 rounded-lg border border-border bg-white">
          {filteredContents.map((content) => renderContent(content))}
        </div>
      );
    }

    // 如果有 type 且 type = user，不做任何处理
    if (item.type === 'user') {
      return null;
    }

    // 如果有 type 且 type = result，什么都不用做
    if (item.type === 'result') {
      return null;
    }

    // 其他的，什么都不用做
    return null;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${username} 的行为明细`} size="2xl" zIndex={zIndex} disableScroll={true}>
      {initialLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
          <span className="ml-2 text-text-secondary">加载中...</span>
        </div>
      ) : total === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>暂无行为记录</p>
        </div>
      ) : (
        <div className="flex flex-col h-[70vh] overflow-hidden">
          {/* Fixed slider section */}
          <div className="flex-shrink-0 pb-2 px-4">
            <div className="flex items-center justify-between mb-2 gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevious}
                  disabled={currentIndex === 0}
                  className="p-1 rounded hover:bg-primary-light text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="上一个"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-text-secondary whitespace-nowrap">
                  <span className="hidden md:inline">记录 </span>
                  {currentIndex + 1} / {total}
                </span>
                <button
                  onClick={handleNext}
                  disabled={currentIndex === total - 1}
                  className="p-1 rounded hover:bg-primary-light text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="下一个"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-3">
                {/* 复制按钮 - 仅桌面端显示 */}
                <button
                  onClick={handleCopyJson}
                  disabled={!currentEntry}
                  className="hidden md:flex items-center gap-1 p-1 rounded hover:bg-primary-light text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="复制JSON"
                >
                  <Copy className="w-4 h-4" />
                </button>

                {/* 移动端复选框 - 简化版 */}
                <div className="flex gap-3 md:hidden">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showToolUse}
                      onChange={(e) => setShowToolUse(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-xs text-orange-500">工具</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showThinking}
                      onChange={(e) => setShowThinking(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-xs text-blue-500">思考</span>
                  </label>
                </div>

                {/* 桌面端复选框 - 完整版 */}
                <div className="hidden md:flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showToolUse}
                      onChange={(e) => setShowToolUse(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-orange-500">工具调用</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showThinking}
                      onChange={(e) => setShowThinking(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-blue-500">思考内容</span>
                  </label>
                </div>
              </div>
            </div>
            <Slider
              value={currentIndex}
              min={0}
              max={total - 1}
              onChange={(_event: Event, newValue: number | number[]) => loadTimelineEntry(newValue as number)}
              step={1}
              marks
              track={false}
              sx = {{'--Slider-markSize': '4px'}}
            />
          </div>

          {/* Entry info - fixed below slider */}
          {currentEntry && (
            <div className="flex-shrink-0 pb-2">
              <div className="p-1 rounded-lg border border-border bg-primary-light/50">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-text-secondary" />
                    <span className="text-sm font-medium text-text-secondary">
                    {formatTimestamp(currentEntry.end_time)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-text-secondary">
                    <div className="flex items-center gap-1">
                      <Timer className="w-4 h-4" />
                      <span>{formatDuration(currentEntry.duration)}</span>
                    </div>
                    <span className="hidden md:block">·</span>
                    <div className="hidden md:block text-xs text-text-secondary">
                      <span>{formatTimestamp(currentEntry.start_time)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Scrollable entry content */}
          <div className="flex-1 overflow-y-auto min-h-0" data-scrollable="true">
            {/* Rendered output */}
            <div className="space-y-1">
              {outputItems.map((item, index) => (
                <div key={index}>
                  {renderItem(item)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
