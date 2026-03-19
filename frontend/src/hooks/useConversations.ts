import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { Conversation, LastMessagePreview } from '@/types';

export function useConversations(unreadOnly: boolean = false, includeEmpty: boolean = true, enabled: boolean = true) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getConversations(unreadOnly, includeEmpty);
      setConversations(data.conversations);
      return data.conversations;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch conversations');
      return [];
    } finally {
      setLoading(false);
    }
  }, [unreadOnly, includeEmpty]);

  const createConversation = useCallback(async (title: string, members: string[]) => {
    const result = await api.createConversation(title, members);
    const conversations = await fetchConversations();
    const newConversation = conversations.find(c => c.conversation_id === result.conversation_id);
    return newConversation;
  }, [fetchConversations]);

  const updateConversation = useCallback(async (conversationId: string, title?: string, announcement?: string) => {
    await api.updateConversation(conversationId, title, announcement);
    await fetchConversations();
  }, [fetchConversations]);

  const clearConversations = useCallback(() => {
    setConversations([]);
  }, []);

  // 标记对话为已读（将未读数设置为0）
  const markConversationAsRead = useCallback((conversationId: string) => {
    setConversations(prevConversations =>
      prevConversations.map(conv =>
        conv.conversation_id === conversationId
          ? { ...conv, unread_count: 0 }
          : conv
      )
    );
  }, []);

  // 增加对话的消息数和未读数（用于收到新消息时）
  const incrementConversationCounts = useCallback((conversationId: string) => {
    setConversations(prevConversations =>
      prevConversations.map(conv =>
        conv.conversation_id === conversationId
          ? {
              ...conv,
              message_count: conv.message_count + 1,
              unread_count: conv.unread_count + 1
            }
          : conv
      )
    );
  }, []);

  // 只增加对话的消息数（用于当前对话收到新消息时）
  const incrementCurrentConversationMessageCount = useCallback((conversationId: string) => {
    setConversations(prevConversations =>
      prevConversations.map(conv =>
        conv.conversation_id === conversationId
          ? {
              ...conv,
              message_count: conv.message_count + 1
            }
          : conv
      )
    );
  }, []);

  // 更新对话的最后一条消息预览
  const updateLastMessagePreview = useCallback((conversationId: string, preview: LastMessagePreview) => {
    setConversations(prevConversations =>
      prevConversations.map(conv =>
        conv.conversation_id === conversationId
          ? {
              ...conv,
              last_message_preview: preview
            }
          : conv
      )
    );
  }, []);

  useEffect(() => {
    if (enabled) {
      fetchConversations();
    }
  }, [fetchConversations, enabled]);

  return { conversations, loading, error, fetchConversations, createConversation, updateConversation, clearConversations, markConversationAsRead, incrementConversationCounts, incrementCurrentConversationMessageCount, updateLastMessagePreview };
}
