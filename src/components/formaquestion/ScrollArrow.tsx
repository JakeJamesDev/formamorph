import { ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { targetAttribute } from '@/lib/surface/surfaceTargets';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import { cn } from '@/lib/utils';

/** The round button at the bottom center of a conversation. It shows while the player is away from the end. */
export function ScrollArrow({ shown, onClick }: { shown: boolean; onClick: () => void }) {
  const reduceMotion = usePrefersReducedMotion();
  if (!shown) return null;
  // The wrapper centers the button, so the entry animation's own transform never moves it.
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex justify-center">
      <Button
        variant="outline"
        size="icon"
        aria-label="Scroll to End"
        {...targetAttribute('formaquestion.ask', 'scroll-to-end')}
        onClick={onClick}
        className={cn('pointer-events-auto size-8 rounded-full bg-background shadow-md', !reduceMotion && 'animate-in fade-in zoom-in-95')}
      >
        <ArrowDown className="size-4" />
      </Button>
    </div>
  );
}
