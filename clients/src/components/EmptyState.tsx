import { cn } from '@/lib/utils';

interface Props {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

const EmptyState = ({ icon, title, description, action, className }: Props) => (
  <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
    <div className="mb-4 text-muted-foreground/50">{icon}</div>
    <h3 className="mb-2 text-lg font-semibold text-foreground">{title}</h3>
    <p className="mb-6 max-w-sm text-sm text-muted-foreground">{description}</p>
    {action}
  </div>
);

export default EmptyState;
