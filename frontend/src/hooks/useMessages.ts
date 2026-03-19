import { useState, useCallback, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import type { MessagesResponse, Message, Conversation } from '@/types';

export function useMessages(conversationId: string | null, conversation?: Conversation | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchConversationIdRef = useRef<string | null>(null);

  // 当 conversationId 变化时，清空消息列表并取消进行中的请求
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setMessages([]);
    setTotalCount(0);
    setUnreadCount(0);
    setError(null);
  }, [conversationId]);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    fetchConversationIdRef.current = conversationId;

    try {
      setLoading(true);
      setError(null);

      const shouldUpdateReadPosition = api.isMasterStaff() && conversation?.is_member === true;

      const data: MessagesResponse = await api.getMessages(conversationId, 999999, shouldUpdateReadPosition);

      if (controller.signal.aborted || fetchConversationIdRef.current !== conversationId) {
        return;
      }

      // 合并而非覆盖：保留 WebSocket 或乐观更新已添加但服务端还未返回的消息
      setMessages(prev => {
        const serverMap = new Map(data.messages.map(m => [m.message_id, m]));
        const wsOnly: Message[] = prev.filter(m => !serverMap.has(m.message_id));
        return [...data.messages, ...wsOnly];
      });
      setTotalCount(data.total_count);
      setUnreadCount(data.unread_count);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Failed to fetch messages');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [conversationId, conversation]);

  const sendMessage = useCallback(async (content: string, attachmentIds: string[] = []) => {
    if (!conversationId) throw new Error('No conversation selected');
    const result = await api.sendMessage(conversationId, content, attachmentIds);

    // 乐观更新：API 成功后立即将消息添加到本地状态，
    // 不依赖 WebSocket 推送来显示自己发送的消息
    const auth = api.getCurrentAuth();
    setMessages(prev => {
      if (prev.some(m => m.message_id === result.message_id)) return prev;
      return [...prev, {
        message_id: result.message_id,
        sender: auth.username || '',
        content,
        attachments: [],
        created_at: new Date().toISOString(),
        read: true,
      }];
    });
  }, [conversationId]);

  return { messages, setMessages, loading, error, totalCount, unreadCount, fetchMessages, sendMessage };
}
