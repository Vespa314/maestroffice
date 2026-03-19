interface ConversationHeaderProps {
  conversationId: string | null;
  title: string;
}

export function ConversationHeader({
  conversationId,
  title,
}: ConversationHeaderProps) {
  if (!conversationId) return null;

  return (
    <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-white">
      <div className="flex-1 min-w-0">
        <h1 className="text-base sm:text-lg font-semibold text-slate-900 truncate mt-3 sm:mt-0 text-center sm:text-left">
          {title}
        </h1>
      </div>
    </div>
  );
}
