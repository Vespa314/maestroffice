import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { WorkspaceFileNode } from '@/types';
import { FileTree, utils } from '@sinm/react-file-tree';
import type { TreeNode } from '@sinm/react-file-tree/lib/type';
import '@sinm/react-file-tree/styles.css';
import { Check, Copy, File, FolderOpen, Loader2, Image as ImageIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Modal } from './Modal';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface WorkspaceViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: string;
  zIndex?: number;
}

export function WorkspaceViewerModal({ isOpen, onClose, role, zIndex }: WorkspaceViewerModalProps) {
  const [tree, setTree] = useState<WorkspaceFileNode | null>(null);
  const [selectedUri, setSelectedUri] = useState<string>('');
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'files' | 'content'>('files');
  const [copied, setCopied] = useState(false);

  // 检测是否为图片文件
  const isImageFile = (uri: string): boolean => {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'];
    const lowerUri = uri.toLowerCase();
    return imageExtensions.some(ext => lowerUri.endsWith(ext));
  };

  // 清理 blob URL（只在组件卸载时清理）
  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
    // 注意：不依赖 imageUrl，只在组件卸载时清理
    // 在 loadFileContent 中手动清理旧的 blob URL
  }, []);

  useEffect(() => {
    if (isOpen && role) {
      // 清空之前的状态（手动清理 blob URL）
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
      setTree(null);
      setSelectedUri('');
      setFileContent(null);
      setImageUrl(null);
      setError(null);
      setActiveTab('files');

      // 加载文件树
      const loadFiles = async () => {
        try {
          setLoading(true);
          setError(null);
          const data = await api.getWorkspaceFiles(role);
          if (data.tree) {
            setTree(data.tree);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load workspace files');
        } finally {
          setLoading(false);
        }
      };

      loadFiles();
    } else if (!isOpen) {
      // 关闭时清空状态
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
      setTree(null);
      setSelectedUri('');
      setFileContent(null);
      setImageUrl(null);
      setError(null);
      setLoading(false);
      setLoadingContent(false);
      setActiveTab('files');
    }
  }, [isOpen, role]); // 移除 imageUrl 依赖，避免无限循环

  const loadFileContent = async (uri: string) => {
    try {
      setLoadingContent(true);
      setError(null);
      setSelectedUri(uri);

      // 清理之前的图片URL
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
        setImageUrl(null);
      }
      setFileContent(null);

      // 检测是否为图片
      if (isImageFile(uri)) {
        // 加载图片：使用专用的下载接口
        // 对路径中的每个部分分别编码，保留斜杠
        const encodedUri = uri.split('/').map(encodeURIComponent).join('/');
        const response = await fetch(`/api/workspace/${encodeURIComponent(role)}/files/${encodedUri}/download`, {
          headers: api.getHeaders()
        });

        if (response.ok) {
          const blob = await response.blob();
          setImageUrl(URL.createObjectURL(blob));
        } else {
          const errorText = await response.text();
          throw new Error(`Failed to load image (${response.status}): ${errorText}`);
        }
      } else {
        // 加载文本内容
        const data = await api.getWorkspaceFile(role, uri);
        setFileContent(data.content);
      }
      // 移动端加载内容后切换到内容标签
      setActiveTab('content');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file content');
    } finally {
      setLoadingContent(false);
    }
  };

  const handleCopy = async () => {
    if (fileContent) {
      try {
        await navigator.clipboard.writeText(fileContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  // 处理节点点击：展开/折叠文件夹，或者选择文件
  const handleItemClick = (treeNode: TreeNode) => {
    const node = treeNode as WorkspaceFileNode;
    if (node.type === 'directory') {
      // 切换文件夹的展开状态
      setTree((prevTree) => {
        if (!prevTree) return null;
        return utils.assignTreeNode(prevTree, node.uri, {
          expanded: !node.expanded
        }) as WorkspaceFileNode;
      });
    } else {
      // 选择文件并加载内容
      setSelectedUri(node.uri);
      loadFileContent(node.uri);
    }
  };

  // 自定义文件项渲染器，带图标
  const renderItem = (treeNode: TreeNode) => {
    const node = treeNode as WorkspaceFileNode;
    const isDirectory = node.type === 'directory';
    const isActive = node.uri === selectedUri;

    return (
      <div
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 rounded transition-colors cursor-pointer',
          isActive ? 'bg-secondary/20 text-secondary' : 'hover:bg-primary-light',
          'text-sm'
        )}
      >
        {isDirectory ? (
          <FolderOpen className="w-4 h-4 flex-shrink-0 text-text-muted" />
        ) : (
          <File className="w-4 h-4 flex-shrink-0 text-text-muted" />
        )}
        <span className="truncate">{node.name}</span>
        {!isDirectory && node.size !== undefined && (
          <span className="ml-auto text-xs text-text-secondary">
            {(node.size / 1024).toFixed(1)} KB
          </span>
        )}
      </div>
    );
  };

  // 自定义排序：文件夹优先，然后按名称排序
  const sorter = (treeNodes: TreeNode[]) => {
    return (treeNodes as WorkspaceFileNode[]).sort((a, b) => {
      // 文件夹优先
      const aIsDir = a.type === 'directory';
      const bIsDir = b.type === 'directory';
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      // 同类型按名称排序
      return a.name.localeCompare(b.name, 'zh-CN');
    });
  };

  // 获取当前选中文件的名称
  const getSelectedFileName = () => {
    if (!tree || !selectedUri) return '';
    const findNode = (node: WorkspaceFileNode, uri: string): WorkspaceFileNode | null => {
      if (node.uri === uri) return node;
      if (node.children) {
        for (const child of node.children) {
          const found = findNode(child, uri);
          if (found) return found;
        }
      }
      return null;
    };
    const node = findNode(tree, selectedUri);
    return node?.name || '';
  };

  // 获取当前选中文件的大小
  const getSelectedFileSize = () => {
    if (!tree || !selectedUri) return 0;
    const findNode = (node: WorkspaceFileNode, uri: string): WorkspaceFileNode | null => {
      if (node.uri === uri) return node;
      if (node.children) {
        for (const child of node.children) {
          const found = findNode(child, uri);
          if (found) return found;
        }
      }
      return null;
    };
    const node = findNode(tree, selectedUri);
    return node?.size || 0;
  };

  return (
    <>
      <style>{`
        .file-tree__tree-item.activated .activated {
          background: rgba(59, 130, 246, 0.2) !important;
        }
      `}</style>
      <Modal isOpen={isOpen} onClose={onClose} title={`工作台 - ${role}`} size="xl" zIndex={zIndex} customWidth="1280px">
        {/* 桌面端：左右分栏 */}
        <div className="hidden sm:flex h-[70vh] flex-row gap-4">
          {/* File Tree */}
          <div className="w-72 flex-shrink-0 border border-border rounded-lg bg-primary-light/50 overflow-hidden flex flex-col">
            <div className="p-3 border-b border-border">
              <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                <FolderOpen className="w-4 h-4" />
                {`${role}的工作台目录`}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-secondary" />
                </div>
              ) : tree ? (
                <FileTree
                  tree={tree}
                  onItemClick={handleItemClick}
                  activatedUri={selectedUri}
                  itemRenderer={renderItem}
                  sorter={sorter}
                />
              ) : (
                <div className="text-center py-8 text-text-secondary text-sm">
                  暂无文件
                </div>
              )}
            </div>
          </div>

          {/* File Content */}
          <div className="flex-1 min-w-0 border border-border rounded-lg bg-primary-light/50 overflow-hidden flex flex-col">
            {selectedUri ? (
              <>
                <div className="p-3 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                    {selectedUri && isImageFile(selectedUri) ? (
                      <ImageIcon className="w-4 h-4 text-green-500" />
                    ) : (
                      <File className="w-4 h-4" />
                    )}
                    <span className="truncate">{getSelectedFileName()}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors hover:bg-primary-light text-text-primary hover:text-secondary"
                      title="复制内容"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>已复制</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>复制</span>
                        </>
                      )}
                    </button>
                    <span className="text-xs text-text-secondary flex-shrink-0">
                      {(getSelectedFileSize() / 1024).toFixed(2)} KB
                    </span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
                  {loadingContent ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-6 h-6 animate-spin text-secondary" />
                    </div>
                  ) : imageUrl ? (
                    <div className="flex items-center justify-center h-full">
                      <img
                        src={imageUrl}
                        alt={getSelectedFileName()}
                        className="max-w-full max-h-full object-contain rounded-lg"
                      />
                    </div>
                  ) : fileContent === null ? (
                    <div className="text-center py-8 text-text-muted text-sm">
                      此文件无法预览
                    </div>
                  ) : (
                    <div className="markdown-body prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                        {fileContent}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-text-secondary">
                <div className="text-center">
                  <File className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>选择一个文件查看内容</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 移动端：标签页切换 */}
        <div className="sm:hidden">
          <Tabs value={activeTab} onValueChange={(value: string) => setActiveTab(value as 'files' | 'content')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="files" className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                文件列表
              </TabsTrigger>
              <TabsTrigger value="content" className="flex items-center gap-2" disabled={!selectedUri}>
                <File className="w-4 h-4" />
                文件内容
              </TabsTrigger>
            </TabsList>

            <TabsContent value="files" className="mt-4">
              <div className="border border-border rounded-lg bg-primary-light/50 overflow-hidden flex flex-col h-[60vh]">
                <div className="flex-1 overflow-y-auto scrollbar-thin">
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-secondary" />
                    </div>
                  ) : tree ? (
                    <FileTree
                      tree={tree}
                      onItemClick={handleItemClick}
                      activatedUri={selectedUri}
                      itemRenderer={renderItem}
                      sorter={sorter}
                    />
                  ) : (
                    <div className="text-center py-8 text-text-secondary text-sm">
                      暂无文件
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="content" className="mt-4">
              <div className="border border-border rounded-lg bg-primary-light/50 overflow-hidden flex flex-col h-[60vh]">
                {selectedUri ? (
                  <>
                    <div className="p-3 border-b border-border flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                        {selectedUri && isImageFile(selectedUri) ? (
                          <ImageIcon className="w-4 h-4 text-green-500" />
                        ) : (
                          <File className="w-4 h-4" />
                        )}
                        <span className="truncate">{getSelectedFileName()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleCopy}
                          className="flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors hover:bg-primary-light text-text-primary hover:text-secondary"
                          title="复制内容"
                        >
                          {copied ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <span className="text-xs text-text-secondary flex-shrink-0">
                          {(getSelectedFileSize() / 1024).toFixed(2)} KB
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
                      {loadingContent ? (
                        <div className="flex items-center justify-center h-full">
                          <Loader2 className="w-6 h-6 animate-spin text-secondary" />
                        </div>
                      ) : imageUrl ? (
                        <div className="flex items-center justify-center h-full">
                          <img
                            src={imageUrl}
                            alt={getSelectedFileName()}
                            className="max-w-full max-h-full object-contain rounded-lg"
                          />
                        </div>
                      ) : fileContent === null ? (
                        <div className="text-center py-8 text-text-muted text-sm">
                          此文件无法预览
                        </div>
                      ) : (
                        <div className="markdown-body prose-invert max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                            {fileContent}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-text-secondary">
                    <div className="text-center">
                      <File className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>选择一个文件查看内容</p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
      </Modal>
    </>
  );
}
