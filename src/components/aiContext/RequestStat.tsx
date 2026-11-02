import type { LucideIcon } from 'lucide-react';
import { Tip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** One plain value on an AI Context request line. The icon stands in for `name`, which screen readers still hear. */
export function RequestStat({ icon: Icon, name, value, tip, className }: { icon: LucideIcon; name: string; value: string; tip: string; className?: string }) {
  return (
    <Tip tip={tip} labelsChild={false}>
      <span className={cn('inline-flex items-center gap-1 text-meta font-normal tabular-nums text-muted-foreground', className)}>
        <Icon className="h-3 w-3 flex-shrink-0" aria-hidden />
        <span className="sr-only">{name}: </span>
        {value}
      </span>
    </Tip>
  );
}
