import { useState, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { Upload, X, FileText, Image, FileArchive, Plus } from 'lucide-react';

interface FileWithPreview extends File {
  preview?: string;
}

interface UploadFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddFiles: (files: File[]) => void;
}

export function UploadFileModal({ isOpen, onClose, onAddFiles }: UploadFileModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<FileWithPreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedFiles([]);
    }
  }, [isOpen]);

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Image className="w-5 h-5 text-green-500" />;
    } else if (file.type.startsWith('text/')) {
      return <FileText className="w-5 h-5 text-blue-500" />;
    } else {
      return <FileArchive className="w-5 h-5 text-orange-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const newFiles = Array.from(files).map(file => {
      const fileWithPreview = file as FileWithPreview;
      // Generate preview for images
      if (file.type.startsWith('image/')) {
        fileWithPreview.preview = URL.createObjectURL(file);
      }
      return fileWithPreview;
    });

    setSelectedFiles(prev => [...prev, ...newFiles]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const handleSubmit = () => {
    if (selectedFiles.length === 0) return;

    onAddFiles(selectedFiles);
    setSelectedFiles([]);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="添加文件附件" size="lg">
      <div className="space-y-4">
        {/* Drag & Drop Zone */}
        <div
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
            ${isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
            }
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />
          <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium text-gray-700 mb-2">
            拖放文件到此处，或点击选择文件
          </p>
          <p className="text-sm text-gray-500">
            支持所有文件类型（图片、文档、视频等）
          </p>
        </div>

        {/* File List */}
        {selectedFiles.length > 0 && (
          <div className="max-h-[40vh] overflow-y-auto scrollbar-thin space-y-2">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                {/* Preview or Icon */}
                {file.preview ? (
                  <img
                    src={file.preview}
                    alt={file.name}
                    className="w-12 h-12 object-cover rounded"
                  />
                ) : (
                  <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                    {getFileIcon(file)}
                  </div>
                )}

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(file.size)}
                  </p>
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => removeFile(index)}
                  className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                  aria-label="移除文件"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-3">
        <button onClick={onClose} className="btn btn-secondary flex-1">
          取消
        </button>
        <button
          onClick={handleSubmit}
          className="btn btn-primary flex-1 flex items-center justify-center gap-2"
          disabled={selectedFiles.length === 0}
        >
          <Plus className="w-4 h-4" />
          添加附件 ({selectedFiles.length})
        </button>
      </div>
    </Modal>
  );
}
