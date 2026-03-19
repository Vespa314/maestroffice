import { MessageSquare, Users, Settings } from 'lucide-react';

interface MobileMenuProps {
  currentUsername: string | null;
  currentCompany: string | null;
  onOpenConversations: () => void;
  onOpenMembers: () => void;
  onOpenSettings: () => void;
  hasActiveConversation: boolean;
}

export function MobileMenu({
  currentUsername,
  currentCompany,
  onOpenConversations,
  onOpenMembers,
  onOpenSettings,
  hasActiveConversation,
}: MobileMenuProps) {
  return (
    <>
      {/* Mobile Header Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-200" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenConversations}
              className="touch-target p-2 -ml-2 rounded-lg text-slate-600 hover:bg-gray-100 transition-colors"
              aria-label={hasActiveConversation ? "返回对话列表" : "打开对话列表"}
            >
              {hasActiveConversation ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              ) : (
                <MessageSquare className="w-5 h-5" />
              )}
            </button>
            <h1 className="text-base font-semibold text-slate-900">
              {currentUsername || 'AI Company'}
            </h1>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {hasActiveConversation && (
              <button
                onClick={onOpenMembers}
                className="touch-target p-2 rounded-lg text-slate-600 hover:bg-gray-100 transition-colors"
                aria-label="成员"
              >
                <Users className="w-5 h-5" />
              </button>
            )}
            {currentCompany && (
              <button
                onClick={onOpenSettings}
                className="touch-target p-2 -mr-2 rounded-lg text-slate-600 hover:bg-gray-100 transition-colors"
                aria-label="员工管理"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
