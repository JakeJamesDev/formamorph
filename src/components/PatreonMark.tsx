import { Heart } from 'lucide-react';
import { gradientClasses, type GradientTone } from '@/components/GradientButton';
import { Tip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** The Patreon button's icon and tone. Every Patreon item wears both. */
export const PatreonIcon = Heart;
export const PATREON_TONE: GradientTone = 'orangeSoft';

const SIZES = {
  sm: { box: 'h-5 w-5', icon: 'h-3 w-3' },
  md: { box: 'h-6 w-6', icon: 'h-3.5 w-3.5' },
} as const;

/**
 * The mark of an item that comes with Patreon support: the Patreon button's heart in its gradient. Stands in
 * for a lock icon. Not focusable, since it sits inside cards that are buttons; `label` is its name.
 */
export function PatreonMark({ label, tip, size = 'sm', className }: {
  label: string;
  tip?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <Tip tip={tip} labelsChild={false}>
      <span
        role="img"
        aria-label={label}
        aria-description={tip}
        data-patreon-mark=""
        className={cn('inline-flex shrink-0 items-center justify-center rounded-md text-black shadow-sm', gradientClasses(PATREON_TONE), SIZES[size].box, className)}
      >
        <PatreonIcon className={SIZES[size].icon} aria-hidden="true" />
      </span>
    </Tip>
  );
}
