import { cn } from '@/lib/utils';

/** The You pill after the played persona's name. `onFill` sits it on a selected row's primary fill. */
export function YouMark({ onFill = false, className }: { onFill?: boolean; className?: string }) {
  // One line box tall, so the pill centers on the host's line in flex and inline hosts alike.
  return (
    <span className={cn('ml-1.5 inline-flex h-[1lh] shrink-0 items-center align-top', className)}>
      <span
        className={cn(
          'inline-flex h-3.5 items-center rounded-full px-1 text-[9px] font-semibold leading-none',
          onFill ? 'bg-primary-foreground text-primary' : 'bg-primary text-primary-foreground',
        )}
      >
        You
      </span>
    </span>
  );
}
