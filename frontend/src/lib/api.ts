import type {
  AttachmentDetail,
  Company,
  ConversationAttachmentsResponse,
  ConversationsResponse,
  MessagesResponse,
  RecommendedUsersResponse,
  SkillsResponse,
  User,
  UserSkillsResponse,
  WorkspaceFileContent,
  WorkspaceFilesResponse,
} from '@/types';
import { toast } from 'react-toastify';

const API_BASE = '/api';

// MASTER_STAFF/管理员配置（从后端API动态获取）
let MASTER_STAFF: string | null = null;

// 认证信息: { company: string, username: string }
let currentAuth: { company: string | null, username: string | null } = {
  company: localStorage.getItem('currentCompany'),
  username: localStorage.getItem('currentUsername')
};

// 统一的错误处理函数
async function handleResponse<T>(response: Response, defaultMessage: string): Promise<T> {
  if (!response.ok) {
    let errorMessage = defaultMessage;
    try {
      const errorData = await response.json();
      if (errorData.detail) {
        errorMessage = errorData.detail;
      }
    } catch (e) {
      // 如果无法解析错误响应，使用默认消息
    }
    toast.error(errorMessage);
    throw new Error(errorMessage);
  }
  return response.json() as Promise<T>;
}

export const api = {
  // Auth management
  getCurrentAuth: () => currentAuth,
  setCurrentAuth: (company: string, username: string) => {
    currentAuth = { company, username };
    localStorage.setItem('currentCompany', company);
    localStorage.setItem('currentUsername', username);
  },
  clearAuth: () => {
    currentAuth = { company: null, username: null };
    localStorage.removeItem('currentCompany');
    localStorage.removeItem('currentUsername');
  },

  // Check if current user is master staff (CEO)
  isMasterStaff: () => {
    if (!MASTER_STAFF) return false;
    const username = currentAuth.username || localStorage.getItem('currentUsername');
    return username === MASTER_STAFF;
  },

  // Check if any given user is master staff
  isUserMasterStaff: (username: string) => {
    if (!MASTER_STAFF) return false;
    return username === MASTER_STAFF;
  },

  // Set MASTER_STAFF value
  setMasterStaff: (value: string) => {
    MASTER_STAFF = value;
  },

  // Helper to get headers with auth
  getHeaders: () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-From-Frontend': 'true',  // 标识来自前端的请求
    };
    // 格式: company:username (company可以为空，如 "company:")
    // 每次都从 localStorage 读取最新值，确保使用最新的认证信息
    const company = localStorage.getItem('currentCompany') || '';
    const username = localStorage.getItem('currentUsername') || '';
    const authValue = `${company}:${username}`;
    headers['X-Auth'] = encodeURIComponent(authValue);
    return headers;
  },

  // Health check
  healthCheck: async () => {
    const response = await fetch(`${API_BASE}/health`, {
      headers: api.getHeaders(),
    });
    return handleResponse(response, '健康检查失败');
  },

  // ============= 公司管理 API =============
  getCompanies: async () => {
    const response = await fetch(`${API_BASE}/users/companies`, {
      headers: api.getHeaders(),
    });
    return handleResponse<Company[]>(response, '获取公司列表失败');
  },

  getRecommendedCompanies: async () => {
    const response = await fetch(`${API_BASE}/users/companies/recommended`, {
      headers: api.getHeaders(),
    });
    return handleResponse<{ companies: string[] }>(response, '获取推荐公司列表失败');
  },

  createCompany: async (name: string) => {
    const response = await fetch(`${API_BASE}/users/companies`, {
      method: 'POST',
      headers: api.getHeaders(),
      body: JSON.stringify({ name }),
    });
    return handleResponse<Company>(response, '创建公司失败');
  },

  getCompanyUsers: async (companyName: string) => {
    const response = await fetch(`${API_BASE}/users/companies/${encodeURIComponent(companyName)}/users`, {
      headers: api.getHeaders(),
    });
    return handleResponse<User[]>(response, '获取公司员工列表失败');
  },

  // ============= 用户管理 API =============
  getUsers: async () => {
    const response = await fetch(`${API_BASE}/users?full_detail=true`, {
      headers: api.getHeaders(),
    });
    return handleResponse<User[]>(response, '获取员工列表失败');
  },

  getRecommendedUsers: async () => {
    const response = await fetch(`${API_BASE}/users/recommended`, {
      headers: api.getHeaders(),
    });
    return handleResponse<RecommendedUsersResponse>(response, '获取推荐员工失败');
  },

  updateUserOnDuty: async (username: string, isOnDuty: boolean) => {
    const response = await fetch(`${API_BASE}/users/${encodeURIComponent(username)}/on-duty`, {
      method: 'PATCH',
      headers: api.getHeaders(),
      body: JSON.stringify({ is_on_duty: isOnDuty }),
    });
    return handleResponse<User>(response, '更新员工值班状态失败');
  },

  createUser: async (companyName: string, username: string) => {
    const response = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: api.getHeaders(),
      body: JSON.stringify({ company_name: companyName, username }),
    });
    return handleResponse<User>(response, '创建员工失败');
  },

  deleteUser: async (username: string) => {
    const response = await fetch(`${API_BASE}/users/${encodeURIComponent(username)}`, {
      method: 'DELETE',
      headers: api.getHeaders(),
    });
    return handleResponse<{ message: string }>(response, '删除员工失败');
  },

  // ============= Timeline API =============
  getUserTimeline: async (username: string, index?: number) => {
    const url = index !== undefined
      ? `${API_BASE}/timeline/${encodeURIComponent(username)}?index=${index}`
      : `${API_BASE}/timeline/${encodeURIComponent(username)}`;
    const response = await fetch(url, {
      headers: api.getHeaders(),
    });
    return handleResponse<{
      entry: { id: number; timestamp: string; output: string; duration: number; start_time: string; end_time: string } | null;
      total: number;
      index: number;
    } | { id: number; timestamp: string; output: string; duration: number; start_time: string; end_time: string }[]>(response, '获取员工行为记录失败');
  },

  // ============= 对话管理 API =============
  getConversations: async (unreadOnly: boolean = false, includeEmpty: boolean = true, includeLastMessage: boolean = true) => {
    const params = new URLSearchParams({
      unread_only: String(unreadOnly),
      include_empty: String(includeEmpty),
      include_last_message: String(includeLastMessage),
    });
    const response = await fetch(`${API_BASE}/conversations?${params}`, {
      headers: api.getHeaders(),
    });
    return handleResponse<ConversationsResponse>(response, '获取对话列表失败');
  },

  createConversation: async (title: string, members: string[]) => {
    const response = await fetch(`${API_BASE}/conversations`, {
      method: 'POST',
      headers: api.getHeaders(),
      body: JSON.stringify({ title, members }),
    });
    return handleResponse<{ conversation_id: string }>(response, '创建对话失败');
  },

  updateConversation: async (conversationId: string, title?: string, announcement?: string) => {
    const response = await fetch(`${API_BASE}/conversations/${conversationId}`, {
      method: 'PUT',
      headers: api.getHeaders(),
      body: JSON.stringify({ title, announcement }),
    });
    return handleResponse<{ message: string }>(response, '更新对话信息失败');
  },

  addConversationMember: async (conversationId: string, username: string) => {
    const response = await fetch(`${API_BASE}/conversations/${conversationId}/members`, {
      method: 'POST',
      headers: api.getHeaders(),
      body: JSON.stringify({ username }),
    });
    return handleResponse<{ message: string }>(response, '添加成员失败');
  },

  addConversationMembersBatch: async (conversationId: string, usernames: string[]) => {
    const response = await fetch(`${API_BASE}/conversations/${conversationId}/members/batch`, {
      method: 'POST',
      headers: api.getHeaders(),
      body: JSON.stringify({ usernames }),
    });
    return handleResponse<{ message: string; added: string[]; already_in_conversation: string[]; not_found: string[] }>(response, '批量添加成员失败');
  },

  removeConversationMember: async (conversationId: string, username: string) => {
    const response = await fetch(`${API_BASE}/conversations/${conversationId}/members/${encodeURIComponent(username)}`, {
      method: 'DELETE',
      headers: api.getHeaders(),
    });
    return handleResponse<{ message: string }>(response, '移除成员失败');
  },

  getConversationAttachments: async (conversationId: string) => {
    const response = await fetch(`${API_BASE}/conversations/${conversationId}/attachments`, {
      headers: api.getHeaders(),
    });
    return handleResponse<ConversationAttachmentsResponse>(response, '获取对话附件失败');
  },

  // ============= 消息管理 API =============
  getMessages: async (conversationId: string, historyCount: number = 999999, updateReadPosition: boolean = false) => {
    const response = await fetch(
      `${API_BASE}/conversations/${conversationId}/messages?history_count=${historyCount}&update_read_position=${updateReadPosition}`,
      { headers: api.getHeaders() }
    );
    return handleResponse<MessagesResponse>(response, '获取消息列表失败');
  },

  sendMessage: async (conversationId: string, content: string, attachmentIds: string[] = []) => {
    const response = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: api.getHeaders(),
      body: JSON.stringify({ content, attachment_ids: attachmentIds }),
    });
    return handleResponse<{ message_id: string }>(response, '发送消息失败');
  },

  // ============= 附件管理 API =============
  uploadFile: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/attachments`, {
      method: 'POST',
      headers: { 'X-Auth': api.getHeaders()['X-Auth'] },
      body: formData
    });
    return handleResponse<{ attachment_id: string; filename: string; mime_type: string }>(response, '上传文件失败');
  },

  createTextAttachment: async (filename: string, content: string) => {
    const formData = new FormData();
    formData.append('text_filename', filename);
    formData.append('text_content', content);

    const response = await fetch(`${API_BASE}/attachments`, {
      method: 'POST',
      headers: { 'X-Auth': api.getHeaders()['X-Auth'] },
      body: formData
    });
    return handleResponse<{ attachment_id: string; filename: string; mime_type: string }>(response, '创建文本附件失败');
  },

  uploadAttachment: async (filename: string, content: string) => {
    // Legacy method for backward compatibility - redirects to createTextAttachment
    return api.createTextAttachment(filename, content);
  },

  getAttachment: async (attachmentId: string) => {
    const response = await fetch(`${API_BASE}/attachments/${attachmentId}`, {
      headers: api.getHeaders(),
    });
    return handleResponse<AttachmentDetail>(response, '获取附件失败');
  },

  // ============= Soul API =============
  getSoul: async (role: string) => {
    const response = await fetch(`${API_BASE}/soul/${encodeURIComponent(role)}`, {
      headers: api.getHeaders(),
    });
    return handleResponse<{ role: string; content: string }>(response, '获取 Soul 文件失败');
  },

  updateSoul: async (role: string, content: string) => {
    const response = await fetch(`${API_BASE}/soul/${encodeURIComponent(role)}`, {
      method: 'PUT',
      headers: api.getHeaders(),
      body: JSON.stringify({ content }),
    });
    return handleResponse<{ role: string; message: string }>(response, '更新 Soul 文件失败');
  },

  getCompanySoul: async (companyName: string) => {
    const response = await fetch(`${API_BASE}/soul/company/${encodeURIComponent(companyName)}`, {
      headers: api.getHeaders(),
    });
    return handleResponse<{ company_name: string; content: string }>(response, '获取公司 Soul 文件失败');
  },

  updateCompanySoul: async (companyName: string, content: string) => {
    const response = await fetch(`${API_BASE}/soul/company/${encodeURIComponent(companyName)}`, {
      method: 'PUT',
      headers: api.getHeaders(),
      body: JSON.stringify({ content }),
    });
    return handleResponse<{ company_name: string; message: string }>(response, '更新公司 Soul 文件失败');
  },

  // ============= Workspace API =============
  getWorkspaceFiles: async (role: string) => {
    const response = await fetch(`${API_BASE}/workspace/${encodeURIComponent(role)}/files`, {
      headers: api.getHeaders(),
    });
    return handleResponse<WorkspaceFilesResponse>(response, '获取工作区文件列表失败');
  },

  getWorkspaceFile: async (role: string, filename: string) => {
    const response = await fetch(`${API_BASE}/workspace/${encodeURIComponent(role)}/files/${encodeURIComponent(filename)}`, {
      headers: api.getHeaders(),
    });
    return handleResponse<WorkspaceFileContent>(response, '获取工作区文件失败');
  },

  // ============= Skills API =============
  getSkills: async () => {
    const response = await fetch(`${API_BASE}/skills`, {
      headers: api.getHeaders(),
    });
    return handleResponse<SkillsResponse>(response, '获取技能列表失败');
  },

  getUserSkills: async (username: string) => {
    const response = await fetch(`${API_BASE}/skills/users/${encodeURIComponent(username)}`, {
      headers: api.getHeaders(),
    });
    return handleResponse<UserSkillsResponse>(response, '获取员工技能失败');
  },

  addUserSkill: async (username: string, skill: string) => {
    const response = await fetch(`${API_BASE}/skills/users/${encodeURIComponent(username)}/skills/${encodeURIComponent(skill)}`, {
      method: 'POST',
      headers: api.getHeaders(),
    });
    return handleResponse<{ message: string }>(response, '添加员工技能失败');
  },

  updateUserSkill: async (username: string, skill: string) => {
    const response = await fetch(`${API_BASE}/skills/users/${encodeURIComponent(username)}/skills/${encodeURIComponent(skill)}`, {
      method: 'PUT',
      headers: api.getHeaders(),
    });
    return handleResponse<{ message: string }>(response, '更新员工技能失败');
  },

  removeUserSkill: async (username: string, skill: string) => {
    const response = await fetch(`${API_BASE}/skills/users/${encodeURIComponent(username)}/skills/${encodeURIComponent(skill)}`, {
      method: 'DELETE',
      headers: api.getHeaders(),
    });
    return handleResponse<{ message: string }>(response, '移除员工技能失败');
  },

  // ============= 管理密码 API =============
  verifyAdminPassword: async (password: string) => {
    const response = await fetch(`${API_BASE}/admin/verify-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });
    const data = await handleResponse<{ valid: boolean }>(response, '验证密码失败');
    return data.valid;
  },

  createAdminPassword: async (password: string) => {
    const response = await fetch(`${API_BASE}/admin/set-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });
    return handleResponse<{ message: string }>(response, '设置密码失败');
  },

  checkPasswordStatus: async () => {
    const response = await fetch(`${API_BASE}/admin/password-status`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse<{ has_password: boolean }>(response, '获取密码状态失败');
  },

  getMasterStaff: async () => {
    const response = await fetch(`${API_BASE}/admin/master-staff`, {
      headers: api.getHeaders(),
    });
    return handleResponse<{ master_staff: string }>(response, '获取管理员配置失败');
  },

  // ============= 员工工作状态 API =============
  getUsersWorkingStatus: async () => {
    const response = await fetch(`${API_BASE}/users/working-status`, {
      headers: api.getHeaders(),
    });
    return handleResponse<{ company_name: string; username: string; is_working: boolean }[]>(response, '获取员工工作状态失败');
  },


  clearAllUsersWorkingStatus: async () => {
    const response = await fetch(`${API_BASE}/users/working-status/clear-all`, {
      method: 'POST',
      headers: api.getHeaders(),
    });
    return handleResponse<{ message: string }>(response, '清空员工工作状态失败');
  },

  // ============= 心跳检测 API =============
  checkHeartbeat: async () => {
    const response = await fetch(`${API_BASE}/heartbeat/check`, {
      headers: api.getHeaders(),
    });
    return handleResponse<{ alive: boolean; pid: number | null; message: string; has_recent_failures: boolean }>(response, '检查心跳失败');
  },

  killHeartbeat: async () => {
    const response = await fetch(`${API_BASE}/heartbeat/kill`, {
      method: 'POST',
      headers: api.getHeaders(),
    });
    return handleResponse<{ message: string }>(response, '停止调度进程失败');
  },

  resumeHeartbeat: async () => {
    const response = await fetch(`${API_BASE}/heartbeat/resume`, {
      method: 'POST',
      headers: api.getHeaders(),
    });
    return handleResponse<{ message: string }>(response, '恢复调度进程失败');
  },
};
