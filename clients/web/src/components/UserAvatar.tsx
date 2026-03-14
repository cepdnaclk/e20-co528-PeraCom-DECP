import { cn } from '@/lib/utils';

interface Props {
  name: string;
  avatar?: string;
  online?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg' };

const UserAvatar = ({ name, avatar, online, size = 'md' }: Props) => {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  
  return (
    <div className="relative inline-flex">
      {avatar ? (
        <img src={avatar} alt={name} className={cn('rounded-full object-cover', sizeClasses[size])} />
      ) : (
        <div className={cn(
          'flex items-center justify-center rounded-full bg-primary/10 font-semibold text-primary',
          sizeClasses[size]
        )}>
          {initials}
        </div>
      )}
      {online !== undefined && (
        <span className={cn(
          'absolute bottom-0 right-0 rounded-full border-2 border-card',
          size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3',
          online ? 'bg-success' : 'bg-muted-foreground/40'
        )} />
      )}
    </div>
  );
};

export default UserAvatar;
