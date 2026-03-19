import { cn } from '@/lib/utils';

interface MemberGridProps {
  members: string[];
  size?: 'sm' | 'md';
  className?: string;
  currentUsername?: string | null;
}

export function MemberGrid({ members, size = 'md', className, currentUsername }: MemberGridProps) {
  // 如果是两个人的对话，只显示另一个人的头像
  const displayMembers = members.length === 2 && currentUsername
    ? members.filter(m => m !== currentUsername)
    : members;

  const memberCount = displayMembers.length;

  // 单个头像（2人对话）
  if (memberCount === 1) {
    const member = displayMembers[0];
    const containerSize = size === 'sm' ? 'w-8 h-8 text-xl' : 'w-12 h-12 text-2xl';
    return (
      <div
        className={cn(
          'flex items-center justify-center font-bold text-white rounded-lg shadow-sm leading-none',
          getUserColorClass(member),
          containerSize,
          className
        )}
        title={member}
      >
        {getFirstChar(member)}
      </div>
    );
  }

  // 2x2 网格（3-4人）
  if (memberCount <= 4) {
    const cellSize = size === 'sm' ? 'w-4 h-4' : 'w-6 h-6';
    const fontSize = size === 'sm' ? 'text-[10px]' : 'text-sm';
    const gridCells = Array.from({ length: 4 }, (_, i) => displayMembers[i] || null);

    return (
      <div
        className={cn(
          'grid grid-cols-2 gap-0.5 bg-slate-200 dark:bg-slate-700 p-0.5 rounded',
          className
        )}
        title={displayMembers.join(', ')}
      >
        {gridCells.map((member, i) => (
          <div
            key={i}
            className={cn(
              'flex items-center justify-center font-bold text-white rounded-sm leading-none',
              member ? getUserColorClass(member) : 'bg-slate-300 dark:bg-slate-600',
              cellSize,
              fontSize
            )}
          >
            {member ? getFirstChar(member) : ''}
          </div>
        ))}
      </div>
    );
  }

  // 3x3 网格（5-9人）
  const cellSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const fontSize = size === 'sm' ? 'text-[9px]' : 'text-[11px]';
  const gridCells = Array.from({ length: 9 }, (_, i) => displayMembers[i] || null);

  return (
    <div
      className={cn(
        'grid grid-cols-3 gap-0.5 bg-slate-200 dark:bg-slate-700 p-0.5 rounded',
        className
      )}
      title={displayMembers.join(', ')}
    >
      {gridCells.map((member, i) => (
        <div
          key={i}
          className={cn(
            'flex items-center justify-center font-bold text-white rounded-sm leading-none',
            member ? getUserColorClass(member) : 'bg-slate-300 dark:bg-slate-600',
            cellSize,
            fontSize
          )}
        >
          {member ? getFirstChar(member) : ''}
        </div>
      ))}
    </div>
  );
}

function getFirstChar(username: string): string {
  return username.charAt(0).toUpperCase();
}

function getUserColorClass(username: string): string {
  const colors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-yellow-500',
    'bg-lime-500',
    'bg-green-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-cyan-500',
    'bg-sky-500',
    'bg-blue-500',
    'bg-indigo-500',
    'bg-violet-500',
    'bg-purple-500',
    'bg-fuchsia-500',
    'bg-pink-500',
    'bg-rose-500',
  ];

  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % colors.length;
  return colors[index];
}
