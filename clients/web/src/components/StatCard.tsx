import { cn } from '@/lib/utils';

interface Props {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; positive: boolean };
  className?: string;
}

const StatCard = ({ title, value, icon, trend, className }: Props) => (
  <div className={cn('rounded-xl border bg-card p-5 transition-shadow hover:shadow-md', className)}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="mt-1 text-2xl font-bold text-card-foreground">{value}</p>
        {trend && (
          <p className={cn('mt-1 text-xs font-medium', trend.positive ? 'text-success' : 'text-destructive')}>
            {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}% from last month
          </p>
        )}
      </div>
      <div className="rounded-lg bg-primary/10 p-2.5 text-primary">{icon}</div>
    </div>
  </div>
);

export default StatCard;
