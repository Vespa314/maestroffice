import { MessageSquare, Users } from 'lucide-react';
import { MemberGrid } from './MemberGrid';
import { cn } from '@/lib/utils';
import type { Conversation } from '@/types';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (conversation: Conversation) => void;
  currentUsername: string | null;
}

export function ConversationList({ conversations, selectedId, onSelect, currentUsername }: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center mt-3">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <MessageSquare className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-sm text-slate-500">暂无对话</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      {conversations.map((conversation) => (
        <button
          key={conversation.conversation_id}
          onClick={() => onSelect(conversation)}
          className={cn(
            'w-full p-4 rounded-xl text-left transition-all duration-200 cursor-pointer group',
            'hover:shadow-md border-2',
            selectedId === conversation.conversation_id
              ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300 shadow-sm'
              : 'bg-white border-gray-200 hover:border-blue-300',
            !conversation.is_member && 'border-dashed border-amber-300 bg-amber-50/30 hover:border-amber-400'
          )}
        >
          <div className="flex items-start gap-3">
            {/* Avatar Grid */}
            <MemberGrid
              members={conversation.members}
              size="md"
              className="flex-shrink-0"
              currentUsername={currentUsername}
            />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className={cn(
                  'font-semibold truncate',
                  selectedId === conversation.conversation_id
                    ? 'text-blue-700'
                    : 'text-slate-900'
                )}>
                  {conversation.title}
                </h3>
                {conversation.unread_count > 0 && (
                  <span className="flex-shrink-0 px-2 py-0.5 text-xs font-bold rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm">
                    {conversation.unread_count}
                  </span>
                )}
              </div>

              {/* 消息预览 */}
              {conversation.last_message_preview && (
                <p className="text-xs text-slate-500 truncate mb-1">
                  {conversation.last_message_preview.sender}: {conversation.last_message_preview.content}
                </p>
              )}

              <div className="flex items-center gap-3 text-xs text-slate-500">
                <div className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  <span>{conversation.members.length}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{conversation.message_count}</span>
                </div>
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
