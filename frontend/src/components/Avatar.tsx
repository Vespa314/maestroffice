import { Crown } from 'lucide-react';
import { getUserColor } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

interface AvatarProps {
  username: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showFullName?: boolean;
  onDoubleClick?: () => void;
}

export function Avatar({ username, size = 'md', className, showFullName = false, onDoubleClick }: AvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  // Get first character for the avatar
  // 如果是 MASTER_STAFF，显示 "BOSS"，否则显示首字母
  const isMasterStaff = api.isUserMasterStaff(username);
  const firstChar = isMasterStaff ? 'BOSS' : username.charAt(0).toUpperCase();

  if (showFullName) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="relative">
          <div
            className={cn(
              'rounded-full flex items-center justify-center font-semibold text-white shadow-md',
              getUserColor(username),
              sizeClasses[size]
            )}
            title={username}
            onDoubleClick={onDoubleClick}
          >
            {firstChar}
          </div>
          {isMasterStaff && (
            <div className="absolute -top-2 left-1/2 -translate-x-1/2">
              <Crown className="w-4 h-4 text-yellow-500" />
            </div>
          )}
        </div>
        <span className="text-sm font-medium text-text-primary">{username}</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        className={cn(
          'rounded-full flex items-center justify-center font-semibold text-white shadow-md',
          getUserColor(username),
          sizeClasses[size],
          className
        )}
        title={username}
        onDoubleClick={onDoubleClick}
      >
        {firstChar}
      </div>
      {isMasterStaff && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2">
          <Crown className="w-4 h-4 text-yellow-500" />
        </div>
      )}
    </div>
  );
}
