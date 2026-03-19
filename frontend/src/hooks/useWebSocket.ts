import { useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';

interface LastMessagePreview {
  message_id: string;
  sender: string;
  content: string;
}

interface WebSocketMessage {
  type: 'new_message' | 'added_to_conversation' | 'conversation_members_updated' | 'conversation_created' | 'working_status_update';
  conversation_id?: string;
  message?: any;
  conversation?: any;
  members?: string[];
  username?: string;
  is_working?: boolean;
  last_message_preview?: LastMessagePreview;
}

interface UseWebSocketOptions {
  conversationId: string | null;
  onMessage: (message: any) => void;
  onAddedToConversation?: (conversation: any) => void;
  onMembersUpdated?: (conversationId: string, members: string[]) => void;
  onConversationCreated?: (conversation: any) => void;
  onOtherConversationMessage?: (conversationId: string) => void;
  onCurrentConversationMessageCount?: (conversationId: string) => void;
  onWorkingStatusUpdate?: (username: string, isWorking: boolean) => void;
  onLastMessagePreviewUpdate?: (conversationId: string, preview: LastMessagePreview) => void;
}

export function useWebSocket({
  conversationId,
  onMessage,
  onAddedToConversation,
  onMembersUpdated,
  onConversationCreated,
  onOtherConversationMessage,
  onCurrentConversationMessageCount,
  onWorkingStatusUpdate,
  onLastMessagePreviewUpdate
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number>();
  const conversationIdRef = useRef(conversationId);
  const onMessageRef = useRef(onMessage);
  const onAddedToConversationRef = useRef(onAddedToConversation);
  const onMembersUpdatedRef = useRef(onMembersUpdated);
  const onConversationCreatedRef = useRef(onConversationCreated);
  const onOtherConversationMessageRef = useRef(onOtherConversationMessage);
  const onCurrentConversationMessageCountRef = useRef(onCurrentConversationMessageCount);
  const onWorkingStatusUpdateRef = useRef(onWorkingStatusUpdate);
  const onLastMessagePreviewUpdateRef = useRef(onLastMessagePreviewUpdate);

  // 同步更新 conversationIdRef，避免 useEffect 延迟导致 WebSocket 消息路由错误
  conversationIdRef.current = conversationId;

  // 保持 refs 最新
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onAddedToConversationRef.current = onAddedToConversation;
  }, [onAddedToConversation]);

  useEffect(() => {
    onMembersUpdatedRef.current = onMembersUpdated;
  }, [onMembersUpdated]);

  useEffect(() => {
    onConversationCreatedRef.current = onConversationCreated;
  }, [onConversationCreated]);

  useEffect(() => {
    onOtherConversationMessageRef.current = onOtherConversationMessage;
  }, [onOtherConversationMessage]);

  useEffect(() => {
    onCurrentConversationMessageCountRef.current = onCurrentConversationMessageCount;
  }, [onCurrentConversationMessageCount]);

  useEffect(() => {
    onWorkingStatusUpdateRef.current = onWorkingStatusUpdate;
  }, [onWorkingStatusUpdate]);

  useEffect(() => {
    onLastMessagePreviewUpdateRef.current = onLastMessagePreviewUpdate;
  }, [onLastMessagePreviewUpdate]);

  const connect = useCallback(() => {
    const auth = api.getCurrentAuth();
    if (!auth.company || !auth.username) return;

    // 根据当前环境确定 WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // WebSocket 不支持自定义 headers，使用查询参数传递认证信息
    const authValue = `${auth.company}:${auth.username}`;
    const wsUrl = `${protocol}//${window.location.host}/ws/messages?auth=${encodeURIComponent(authValue)}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      // WebSocket connected
    };

    ws.onmessage = (event) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data);

        switch (data.type) {
          case 'new_message':
            // 使用 ref 获取最新的 conversationId
            if (data.conversation_id === conversationIdRef.current) {
              // 当前对话的消息，添加到消息列表并只增加消息数
              if (onCurrentConversationMessageCountRef.current && data.conversation_id) {
                onCurrentConversationMessageCountRef.current(data.conversation_id);
              }
              onMessageRef.current(data.message!);
            } else {
              // 其他对话的消息，更新对话列表的计数（消息数和未读数都+1）
              if (onOtherConversationMessageRef.current && data.conversation_id) {
                onOtherConversationMessageRef.current(data.conversation_id);
              }
            }
            // 更新最后一条消息预览（所有对话都需要更新）
            if (onLastMessagePreviewUpdateRef.current && data.conversation_id && data.last_message_preview) {
              onLastMessagePreviewUpdateRef.current(data.conversation_id, data.last_message_preview);
            }
            break;

          case 'added_to_conversation':
            // 新对话被创建，用户被添加到对话
            if (onAddedToConversationRef.current && data.conversation) {
              onAddedToConversationRef.current(data.conversation);
            }
            break;

          case 'conversation_created':
            // MASTER_STAFF收到新对话创建通知（即使不在对话中）
            if (onConversationCreatedRef.current && data.conversation) {
              onConversationCreatedRef.current(data.conversation);
            }
            break;

          case 'conversation_members_updated':
            // 对话成员列表更新
            if (onMembersUpdatedRef.current && data.conversation_id && data.members) {
              onMembersUpdatedRef.current(data.conversation_id, data.members);
            }
            break;

          case 'working_status_update':
            // 员工工作状态更新
            if (onWorkingStatusUpdateRef.current && data.username && data.is_working !== undefined) {
              onWorkingStatusUpdateRef.current(data.username, data.is_working);
            }
            break;
        }
      } catch (e) {
        // Failed to parse WebSocket message
      }
    };

    ws.onerror = (_error) => {
      // WebSocket error
    };

    ws.onclose = () => {
      // WebSocket disconnected, reconnecting in 3s
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };

    wsRef.current = ws;
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // 发送心跳
  const sendHeartbeat = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send('ping');
    }
  }, []);

  useEffect(() => {
    connect();
    const heartbeatInterval = setInterval(sendHeartbeat, 30000);

    return () => {
      clearInterval(heartbeatInterval);
      disconnect();
    };
  }, [connect, disconnect, sendHeartbeat]);

  return null;
}
