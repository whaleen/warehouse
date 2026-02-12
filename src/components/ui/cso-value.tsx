import { cn } from '@/lib/utils';

type CsoValueProps = {
  value?: string | null;
  className?: string;
  headClassName?: string;
  tailClassName?: string;
};

export function CsoValue({ value, className, headClassName, tailClassName }: CsoValueProps) {
  const trimmed = value?.toString().trim() ?? '';
  if (!trimmed) return null;

  if (trimmed.length <= 4) {
    return (
      <span
        className={cn('underline decoration-dotted underline-offset-2', className, tailClassName)}
      >
        {trimmed}
      </span>
    );
  }

  const head = trimmed.slice(0, -4);
  const tail = trimmed.slice(-4);

  return (
    <span className={cn(className)}>
      <span className={headClassName}>{head}</span>
      <span className={cn('underline decoration-dotted underline-offset-2', tailClassName)}>
        {tail}
      </span>
    </span>
  );
}
