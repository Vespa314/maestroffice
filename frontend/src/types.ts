// MIME类型判断工具函数
export function isTextMime(mime_type: string): boolean {
  return mime_type.startsWith('text/');
}

export function isImageMime(mime_type: string): boolean {
  return mime_type.startsWith('image/');
}

// 预留扩展
export function isVideoMime(mime_type: string): boolean {
  return mime_type.startsWith('video/');
}

export function isAudioMime(mime_type: string): boolean {
  return mime_type.startsWith('audio/');
}

export interface Company {
  name: string;
  created_at: string;
}

export interface User {
  company_name: string;
  username: string;
  is_on_duty: boolean;
}

export interface LastMessagePreview {
  message_id: string;
  sender: string;
  content: string;
}

export interface Conversation {
  conversation_id: string;
  title: string;
  announcement: string;
  members: string[];
  created_at: string;
  message_count: number;
  unread_count: number;
  is_member: boolean;
  last_message_preview?: LastMessagePreview;
}

export interface MessageAttachment {
  attachment_id: string;
  filename: string;
  mime_type: string;  // 新增: 完整MIME类型
}

export interface Message {
  message_id: string;
  sender: string;
  content: string;
  attachments: MessageAttachment[];
  created_at: string;
  read: boolean;
}

export interface Attachment {
  attachment_id: string;
  filename: string;
  mime_type: string;  // 新增
  uploaded_at: string;
  uploaded_by: string;
  message_id?: string;
}

export interface AttachmentDetail extends Attachment {
  content?: string;  // text类型有内容
  download_url?: string;  // 非text类型有下载链接
  file_size?: number;
}

// Workspace File Tree Types (for @sinm/react-file-tree)
export interface WorkspaceFileNode {
  uri: string;
  type: 'file' | 'directory';
  name: string;
  size?: number;
  modified?: number;
  expanded?: boolean;
  activated?: boolean;
  children?: WorkspaceFileNode[];
}

export interface WorkspaceFile {
  filename: string;
  size: number;
  modified: number;
}

export interface WorkspaceFileContent extends WorkspaceFile {
  content: string | null;
  message?: string;
}

// API Response Types
export interface ConversationsResponse {
  conversations: Conversation[];
}

export interface MessagesResponse {
  conversation: {
    conversation_id: string;
    title: string;
    announcement: string;
  };
  total_count: number;
  unread_count: number;
  messages: Message[];
}

export interface ConversationAttachmentsResponse {
  attachments: Attachment[];
}

export interface RecommendedUsersResponse {
  users: string[];
}

export interface SkillsResponse {
  skills: string[];
}

export interface UserSkillsResponse {
  skills: string[];
}

export interface WorkspaceFilesResponse {
  role: string;
  files?: WorkspaceFile[];
  tree?: WorkspaceFileNode;
}
