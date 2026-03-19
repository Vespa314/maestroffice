import { Lock } from 'lucide-react';
import { useCallback, useEffect, useState, lazy, Suspense } from 'react';
import { ChatPanel } from './components/ChatPanel';
import { MobileMenu } from './components/MobileMenu';
import { PasswordModal } from './components/PasswordModal';
import { Sidebar } from './components/Sidebar';
import { TooltipProvider } from './components/Tooltip';
import { useConversations } from './hooks/useConversations';
import { useMessages } from './hooks/useMessages';
import { useUsers } from './hooks/useUsers';
import { useWebSocket } from './hooks/useWebSocket';
import { api } from './lib/api';
import type { Conversation } from './types';

// 懒加载大型Modal组件
const CreateCompanyModal = lazy(() => import('./components/CreateCompanyModal').then(m => ({ default: m.CreateCompanyModal })));
const CreateConversationModal = lazy(() => import('./components/CreateConversationModal').then(m => ({ default: m.CreateConversationModal })));
const UserManagementModal = lazy(() => import('./components/UserManagementModal').then(m => ({ default: m.UserManagementModal })));

// MASTER_STAFF/管理员配置（将从后端API动态获取）
let MASTER_STAFF: string | null = null;

function App() {
  // 密码保护状态
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [isCheckingPassword, setIsCheckingPassword] = useState(true);
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);

  // 应用状态（必须在条件返回之前声明所有 hooks）
  const auth = api.getCurrentAuth();
  const [currentCompany, setCurrentCompany] = useState<string | null>(auth.company);
  const [currentUsername, setCurrentUsername] = useState<string | null>(auth.username);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

  // Mobile sidebar states
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileRightSidebarOpen, setMobileRightSidebarOpen] = useState(false);

  // Modal states
  const [showCreateConversation, setShowCreateConversation] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showCreateCompany, setShowCreateCompany] = useState(false);

  // MASTER_STAFF 加载状态
  const [masterStaffLoaded, setMasterStaffLoaded] = useState(false);

  // User working status state (shared across components)
  const [userWorkingStatus, setUserWorkingStatus] = useState<Record<string, boolean>>({});

  // Company management
  const [companies, setCompanies] = useState<string[]>([]);
  const [companiesFetched, setCompaniesFetched] = useState(false);

  // 检查本地存储的密码
  useEffect(() => {
    const checkStoredPassword = async () => {
      // 首先获取 MASTER_STAFF 配置
      try {
        const data = await api.getMasterStaff();
        MASTER_STAFF = data.master_staff;
        api.setMasterStaff(data.master_staff);
        setMasterStaffLoaded(true);
      } catch (error) {
        console.error('Failed to fetch MASTER_STAFF:', error);
        // 使用默认值
        MASTER_STAFF = 'CEO';
        api.setMasterStaff('CEO');
        setMasterStaffLoaded(true);
      }

      // 首先检查后端是否已设置密码
      try {
        const status = await api.checkPasswordStatus();
        setHasPassword(status.has_password);
      } catch (error) {
        setHasPassword(false);
      }

      const storedPassword = localStorage.getItem('adminPassword');
      if (storedPassword) {
        try {
          const isValid = await api.verifyAdminPassword(storedPassword);
          if (isValid) {
            setIsAuthenticated(true);
            setShowPasswordModal(false);
            setIsCheckingPassword(false);
            return;
          }
        } catch (error) {
          // 验证失败，清除本地存储并显示密码输入
          localStorage.removeItem('adminPassword');
        }
      }
      // 没有本地密码或验证失败，显示密码输入
      setIsAuthenticated(false);
      setShowPasswordModal(true);
      setIsCheckingPassword(false);
    };

    checkStoredPassword();
  }, []);

  const handlePasswordSuccess = useCallback(() => {
    setIsAuthenticated(true);
    setShowPasswordModal(false);
  }, []);

  const fetchCompanies = useCallback(async () => {
    try {
      const data = await api.getCompanies();
      setCompanies(data.map(c => c.name));
      setCompaniesFetched(true);
    } catch (error) {
      // Failed to fetch companies
      setCompaniesFetched(true);
    }
  }, []);

  const fetchUserWorkingStatus = useCallback(async () => {
    try {
      const statuses = await api.getUsersWorkingStatus();
      // 将数组转换为对象：{ username: is_working }
      const statusMap: Record<string, boolean> = {};
      statuses.forEach(status => {
        statusMap[status.username] = status.is_working;
      });
      setUserWorkingStatus(statusMap);
    } catch (error) {
      // Failed to fetch user working status
      console.error('Failed to fetch user working status:', error);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && masterStaffLoaded) {
      fetchCompanies();
      fetchUserWorkingStatus();
    }
  }, [fetchCompanies, fetchUserWorkingStatus, isAuthenticated, masterStaffLoaded]);

  const { users, fetchUsers, createUser } = useUsers(isAuthenticated && !!currentCompany);
  const { conversations, fetchConversations, createConversation, clearConversations, markConversationAsRead, incrementConversationCounts, incrementCurrentConversationMessageCount, updateLastMessagePreview } = useConversations(false, true, isAuthenticated && !!currentCompany && !!currentUsername);
  const { messages, setMessages, loading: messagesLoading, fetchMessages, sendMessage } = useMessages(
    selectedConversation?.conversation_id || null,
    selectedConversation
  );

  // 检查公司列表并清理无效的认证信息
  useEffect(() => {
    // 只有在已认证、已经获取过公司列表且 MASTER_STAFF 已加载后才进行验证
    if (!isAuthenticated || !companiesFetched || !masterStaffLoaded || !MASTER_STAFF) {
      return;
    }

    // 如果没有公司，清理所有认证信息并弹出创建公司弹窗
    if (companies.length === 0) {
      api.clearAuth();
      setCurrentCompany(null);
      setCurrentUsername(null);
      setSelectedConversation(null);
      clearConversations();
      setMessages([]);
      setShowCreateCompany(true);
      return;
    }

    // 如果当前没有选中公司但有公司列表存在，自动选择第一家公司
    if (!currentCompany && companies.length > 0) {
      const company = companies[0];
      // 先清空当前对话列表和消息
      clearConversations();
      setMessages([]);

      setCurrentCompany(company);
      setCurrentUsername(null);
      setSelectedConversation(null);

      // 立即更新 API 认证信息（不等待 setState 完成）
      api.setCurrentAuth(company, '');

      // 获取该公司用户列表
      api.getCompanyUsers(company).then((companyUsers) => {
        if (companyUsers.length > 0) {
          // 优先选择 MASTER_STAFF，否则选择第一个用户
          const masterStaff = companyUsers.find(u => u.username === MASTER_STAFF);
          const userToLogin = masterStaff || companyUsers[0];

          // 立即更新认证信息并切换用户
          api.setCurrentAuth(company, userToLogin.username);
          setCurrentUsername(userToLogin.username);

          // 拉取对话、用户列表和工作状态
          fetchConversations();
          fetchUsers();
          fetchUserWorkingStatus();
        } else {
          // 没有用户，只拉取用户列表（应为空）
          fetchUsers();
        }
      });
      return;
    }

    // 如果有公司但当前选中的公司不在列表中，清理认证信息
    if (currentCompany && !companies.includes(currentCompany)) {
      api.clearAuth();
      setCurrentCompany(null);
      setCurrentUsername(null);
      setSelectedConversation(null);
      clearConversations();
      setMessages([]);
    }
  }, [companies, isAuthenticated, currentCompany, companiesFetched, clearConversations, fetchConversations, fetchUsers, setMessages]);

  useEffect(() => {
    // 无论 company 和 username 是否为空，都更新认证信息
    // 支持 company: 格式用于未登录状态
    api.setCurrentAuth(currentCompany || '', currentUsername || '');
  }, [currentCompany, currentUsername]);

  // Get recommended users
  const [recommendedUsers, setRecommendedUsers] = useState<string[]>([]);

  const fetchRecommendedUsers = useCallback(() => {
    if (currentCompany) {
      api.getRecommendedUsers()
        .then(data => setRecommendedUsers(data.users))
        .catch(() => setRecommendedUsers([]));
    }
  }, [currentCompany]);

  // Only fetch recommended users when user management modal is opened
  useEffect(() => {
    if (showUserManagement) {
      fetchRecommendedUsers();
    }
  }, [showUserManagement, fetchRecommendedUsers]);

  const handleSelectConversation = useCallback((conversation: Conversation) => {
    setSelectedConversation(conversation);
    // 只有MASTER_STAFF点击自己所在的对话时，才立即将未读数设置为0（乐观更新）
    if (api.isMasterStaff() && conversation.is_member) {
      markConversationAsRead(conversation.conversation_id);
    }
  }, [markConversationAsRead]);

  const handleRefresh = useCallback(async () => {
    await fetchConversations();
    fetchUsers();
    fetchRecommendedUsers();
    fetchUserWorkingStatus();
    if (selectedConversation) {
      fetchMessages();
      // 直接获取更新后的对话数据
      const data = await api.getConversations(false, true);
      const updatedConversation = data.conversations.find(
        (c: Conversation) => c.conversation_id === selectedConversation.conversation_id
      );
      if (updatedConversation) {
        setSelectedConversation(updatedConversation);
      }
    }
  }, [fetchUsers, fetchConversations, fetchRecommendedUsers, fetchUserWorkingStatus, fetchMessages, selectedConversation]);

  const handleSwitchCompany = async (company: string) => {
    if (!company) {
      // 打开公司切换器
      return;
    }
    // 先清空当前对话列表和消息
    clearConversations();
    setMessages([]);

    setCurrentCompany(company);
    setCurrentUsername(null);
    setSelectedConversation(null);

    // 立即更新 API 认证信息（不等待 setState 完成）
    api.setCurrentAuth(company, '');

    // 获取该公司用户列表
    const companyUsers = await api.getCompanyUsers(company);

    if (companyUsers.length > 0) {
      // 优先选择 MASTER_STAFF，否则选择第一个用户
      const masterStaff = companyUsers.find(u => u.username === MASTER_STAFF);
      const userToLogin = masterStaff || companyUsers[0];

      // 立即更新认证信息并切换用户
      api.setCurrentAuth(company, userToLogin.username);
      setCurrentUsername(userToLogin.username);

      // 拉取对话、用户列表和工作状态
      await fetchConversations();
      await fetchUsers();
      fetchUserWorkingStatus();
    } else {
      // 没有用户，只拉取用户列表（应为空）
      await fetchUsers();
    }
  };

  const handleCompanyCreated = async (companyName: string) => {
    await fetchCompanies();
    // 先清空当前对话列表和消息
    clearConversations();
    setMessages([]);

    setCurrentCompany(companyName);
    setCurrentUsername(null);
    setSelectedConversation(null);

    // 立即更新 API 认证信息（不等待 setState 完成）
    api.setCurrentAuth(companyName, '');

    // 获取新创建公司的用户列表
    const companyUsers = await api.getCompanyUsers(companyName);

    if (companyUsers.length > 0) {
      // 优先选择 MASTER_STAFF，否则选择第一个用户
      const masterStaff = companyUsers.find(u => u.username === MASTER_STAFF);
      const userToLogin = masterStaff || companyUsers[0];

      // 立即更新认证信息并切换用户
      api.setCurrentAuth(companyName, userToLogin.username);
      setCurrentUsername(userToLogin.username);

      // 拉取对话、用户列表和工作状态
      await fetchConversations();
      await fetchUsers();
      fetchUserWorkingStatus();
    } else {
      // 没有用户，只拉取用户列表（应为空）
      await fetchUsers();
    }
  };

  const handleSwitchUser = async (username: string) => {
    // 先清空对话列表和消息，避免显示旧用户的数据
    clearConversations();
    setMessages([]);

    // 立即更新 API 认证信息（不等待 setState 完成）
    if (currentCompany) {
      api.setCurrentAuth(currentCompany, username);
    }

    setCurrentUsername(username);
    setSelectedConversation(null);

    // 重新拉取该用户的对话列表和工作状态
    await fetchConversations();
    fetchUsers();
    fetchRecommendedUsers();
    fetchUserWorkingStatus();
  };

  const handleCreateConversation = async (title: string, members: string[]) => {
    const newConversation = await createConversation(title, members);
    // 自动选中新创建的对话
    if (newConversation) {
      setSelectedConversation(newConversation);
    }
  };

  const handleCreateUser = async (username: string) => {
    if (!currentCompany) {
      return;
    }
    await createUser(currentCompany, username);
    fetchUserWorkingStatus();
  };

  const handleToggleOnDuty = async (username: string, isOnDuty: boolean) => {
    await api.updateUserOnDuty(username, isOnDuty);
    handleRefresh();
  };

  const handleDeleteUser = async (username: string) => {
    await api.deleteUser(username);
    // 如果删除的是当前用户，需要切换到其他用户
    if (username === currentUsername) {
      const remainingUsers = users.filter(u => u.username !== username);
      if (remainingUsers.length > 0) {
        const newUsername = remainingUsers[0].username;

        // 清空旧数据
        clearConversations();
        setMessages([]);

        // 立即更新 API 认证信息
        if (currentCompany) {
          api.setCurrentAuth(currentCompany, newUsername);
        }

        setCurrentUsername(newUsername);
        setSelectedConversation(null);
        await fetchConversations();
        fetchUserWorkingStatus();
      } else {
        // 如果没有用户了，清空当前用户
        clearConversations();
        setMessages([]);
        api.clearAuth();
        setCurrentUsername(null);
        setSelectedConversation(null);
      }
    }
  };

  // Mobile sidebar handlers
  const handleOpenMobileSidebar = () => {
    setMobileSidebarOpen(true);
  };

  const handleCloseMobileSidebar = () => {
    setMobileSidebarOpen(false);
  };

  const handleOpenMobileRightSidebar = () => {
    setMobileRightSidebarOpen(true);
  };

  const handleCloseMobileRightSidebar = () => {
    setMobileRightSidebarOpen(false);
  };

  // Fetch messages when conversation changes
  useEffect(() => {
    if (selectedConversation) {
      fetchMessages();
    }
  }, [selectedConversation?.conversation_id, fetchMessages]);

  // WebSocket: 实时接收新消息
  const handleWebSocketMessage = useCallback((message: any) => {
    setMessages(prev => {
      const idx = prev.findIndex(m => m.message_id === message.message_id);
      if (idx !== -1) {
        // 已存在（乐观更新的消息）→ 用 WebSocket 的完整数据替换（含附件等）
        const updated = [...prev];
        updated[idx] = message;
        return updated;
      }
      return [...prev, message];
    });
  }, []);

  // WebSocket: 处理对话的新消息（更新对话列表计数）
  const handleOtherConversationMessage = useCallback((conversationId: string) => {
    incrementConversationCounts(conversationId);
  }, [incrementConversationCounts]);

  // WebSocket: 处理当前对话的新消息（只增加消息数）
  const handleCurrentConversationMessageCount = useCallback((conversationId: string) => {
    incrementCurrentConversationMessageCount(conversationId);
  }, [incrementCurrentConversationMessageCount]);

  // WebSocket: 处理消息预览更新
  const handleLastMessagePreviewUpdate = useCallback((conversationId: string, preview: any) => {
    updateLastMessagePreview(conversationId, preview);
  }, [updateLastMessagePreview]);

  // WebSocket: 处理被添加到新对话
  const handleAddedToConversation = useCallback((_conversation: any) => {
    // 将新对话添加到对话列表（如果还没有的话）
    fetchConversations();
  }, [fetchConversations]);

  // WebSocket: 处理新对话创建（MASTER_STAFF收到即使不在对话中）
  const handleConversationCreated = useCallback((_conversation: any) => {
    // 重新获取对话列表以显示新对话
    fetchConversations();
  }, [fetchConversations]);

  // WebSocket: 处理对话成员更新
  const handleMembersUpdated = useCallback((conversationId: string, members: string[]) => {
    // 如果是当前对话，更新其成员列表
    if (selectedConversation?.conversation_id === conversationId) {
      setSelectedConversation(prev => prev ? { ...prev, members } : null);
    }
    // 重新获取对话列表以更新成员信息
    fetchConversations();
  }, [selectedConversation, fetchConversations]);

  // WebSocket: 处理员工工作状态更新
  const handleWorkingStatusUpdate = useCallback((username: string, isWorking: boolean) => {
    setUserWorkingStatus(prev => ({
      ...prev,
      [username]: isWorking
    }));
  }, []);

  // 更新浏览器标签页标题，显示正在工作的人数/on_duty的人数
  useEffect(() => {
    const workingCount = Object.values(userWorkingStatus).filter(isWorking => isWorking).length;
    const onDutyCount = users.filter(user => user.is_on_duty).length;
    
    // 获取原始标题（去掉之前添加的后缀）
    const baseTitle = document.title.replace(/\s*\[\d+\/\d+\]$/, '');
    
    // 只有当 on_duty 人数大于 0 时才显示这些信息
    if (onDutyCount > 0) {
      document.title = `${baseTitle} [${workingCount}/${onDutyCount}]`;
    } else {
      document.title = baseTitle;
    }
  }, [userWorkingStatus, users]);

  useWebSocket({
    conversationId: selectedConversation?.conversation_id || null,
    onMessage: handleWebSocketMessage,
    onOtherConversationMessage: handleOtherConversationMessage,
    onAddedToConversation: handleAddedToConversation,
    onConversationCreated: handleConversationCreated,
    onMembersUpdated: handleMembersUpdated,
    onCurrentConversationMessageCount: handleCurrentConversationMessageCount,
    onWorkingStatusUpdate: handleWorkingStatusUpdate,
    onLastMessagePreviewUpdate: handleLastMessagePreviewUpdate
  });

  // 如果正在检查密码，显示加载状态
  if (isCheckingPassword) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  // 如果未通过密码验证，显示密码输入
  if (!isAuthenticated) {
    return (
      <>
        <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
          <div className="text-center">
            <Lock className="w-16 h-16 text-blue-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-800 mb-2">AI Company Management</h1>
            <p className="text-gray-600">请输入密码以访问管理系统</p>
          </div>
        </div>
        <PasswordModal
          isOpen={showPasswordModal}
          onSuccess={handlePasswordSuccess}
          hasPassword={hasPassword}
        />
      </>
    );
  }

  return (
    <TooltipProvider>
      <div className="mobile-h-screen flex overflow-hidden pb-safe-bottom">
      {/* Mobile Top Menu - Only visible on mobile */}
      <MobileMenu
        currentUsername={currentUsername}
        currentCompany={currentCompany}
        onOpenConversations={handleOpenMobileSidebar}
        onOpenMembers={handleOpenMobileRightSidebar}
        onOpenSettings={() => setShowUserManagement(true)}
        hasActiveConversation={!!selectedConversation}
      />

      {/* Left Sidebar */}
      <div className={`
        fixed lg:relative z-40 h-full transition-transform duration-300 ease-in-out
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Sidebar
          conversations={conversations}
          selectedConversationId={selectedConversation?.conversation_id || null}
          onSelectConversation={(conversation) => {
            handleSelectConversation(conversation);
            handleCloseMobileSidebar();
          }}
          currentCompany={currentCompany}
          currentUsername={currentUsername}
          users={users}
          companies={companies}
          recommendedUsers={recommendedUsers}
          onRefresh={handleRefresh}
          onCreateConversation={() => setShowCreateConversation(true)}
          onCreateUser={() => setShowUserManagement(true)}
          onSwitchUser={handleSwitchUser}
          onFetchRecommendedUsers={fetchRecommendedUsers}
          onSwitchCompany={handleSwitchCompany}
          onCreateCompany={() => setShowCreateCompany(true)}
          userWorkingStatus={userWorkingStatus}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={handleCloseMobileSidebar}
        />
      )}

      {/* Main Chat Panel */}
      <div className="flex-1 flex flex-col min-w-0 pt-14 lg:pt-0">
        <ChatPanel
          conversationId={selectedConversation?.conversation_id || null}
          title={selectedConversation?.title || ''}
          announcement={selectedConversation?.announcement || ''}
          members={selectedConversation?.members || []}
          messages={messages}
          loading={messagesLoading}
          currentUsername={currentUsername}
          onSendMessage={sendMessage}
          onRefresh={handleRefresh}
          mobileRightSidebarOpen={mobileRightSidebarOpen}
          onCloseMobileRightSidebar={handleCloseMobileRightSidebar}
          userWorkingStatus={userWorkingStatus}
        />
      </div>

      {/* Modals */}
      <Suspense fallback={null}>
        <CreateConversationModal
          isOpen={showCreateConversation}
          onClose={() => setShowCreateConversation(false)}
          onCreate={async (title, members) => {
            await handleCreateConversation(title, members);
            fetchConversations();
            fetchUsers();
            fetchUserWorkingStatus();
          }}
          users={users}
          currentUsername={currentUsername}
        />

        <UserManagementModal
          isOpen={showUserManagement}
          onClose={() => setShowUserManagement(false)}
          users={users}
          currentCompany={currentCompany}
          currentUsername={currentUsername}
          recommendedUsers={recommendedUsers}
          onSwitchUser={(username) => {
            handleSwitchUser(username);
            setShowUserManagement(false);
          }}
          onToggleOnDuty={handleToggleOnDuty}
          onCreateUser={async (username) => {
            await handleCreateUser(username);
            handleRefresh();
            fetchRecommendedUsers();
          }}
          onDeleteUser={handleDeleteUser}
          onRefresh={handleRefresh}
          userWorkingStatus={userWorkingStatus}
        />

        <CreateCompanyModal
          isOpen={showCreateCompany}
          onClose={() => setShowCreateCompany(false)}
          onCompanyCreated={handleCompanyCreated}
          forceOpen={companies.length === 0}
        />
      </Suspense>
    </div>
    </TooltipProvider>
  );
}

export default App;
