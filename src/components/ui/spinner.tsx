import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type SpinnerProps = React.ComponentProps<typeof Loader2> & {
  size?: 'sm' | 'md' | 'lg';
};

const sizeClasses: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export function Spinner({ size = 'md', className, ...props }: SpinnerProps) {
  return <Loader2 className={cn('animate-spin', sizeClasses[size], className)} {...props} />;
}
