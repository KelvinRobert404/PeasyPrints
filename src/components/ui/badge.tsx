import { cn } from '@/lib/utils/cn';

type Variant = 'default' | 'secondary' | 'destructive' | 'outline';

export function Badge({ className, variant = 'default', children }: { className?: string; variant?: Variant; children?: React.ReactNode }) {
  const base = 'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium';
  const styles: Record<Variant, string> = {
    default: 'bg-green-600/10 text-green-700 border border-green-600/20',
    secondary: 'bg-gray-600/10 text-gray-800 border border-gray-600/20',
    destructive: 'bg-red-600/10 text-red-700 border border-red-600/20',
    outline: 'border border-gray-300 text-gray-700'
  };
  return <span className={cn(base, styles[variant], className)}>{children}</span>;
}


