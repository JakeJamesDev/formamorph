import { type ReactNode } from 'react';
import { Popover, PopoverAnchor, PopoverArrow, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import type { TutorialEntry } from '@/lib/tutorials';

/**
 * Wraps the control a tutorial explains and shows the explanation beside it. `open` is fully controlled
 * with no `onOpenChange`, so Radix's own dismissals (outside click, Escape) can't close it — only the
 * button or engaging with the control itself counts, and a stray click can't silently retire an
 * explanation the user never read.
 */
export function TutorialPopover({ entry, onDismiss, side = 'bottom', align = 'end', children }: {
  entry: TutorialEntry | null;
  onDismiss: () => void;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  children: ReactNode;
}) {
  const reduceMotion = usePrefersReducedMotion();
  return (
    <Popover open={!!entry}>
      <PopoverAnchor asChild>{children}</PopoverAnchor>
      {entry && (
        <PopoverContent
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={12}
          // The app's <body> is a zero-height fixed-layout shell, so the default clipping-ancestor
          // boundary reports no room anywhere and flips the popover off the top of the screen.
          collisionBoundary={typeof document === 'undefined' ? undefined : document.documentElement}
          role="dialog"
          aria-label={entry.title}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={`w-72 space-y-2 ${reduceMotion ? 'animate-none' : ''}`}
        >
          <PopoverArrow />
          <p className="font-medium leading-none">{entry.title}</p>
          {entry.body && <p className="text-helper text-muted-foreground">{entry.body}</p>}
          {entry.points && (
            <div className="space-y-1">
              {entry.points.map((p) => (
                <p key={p.term} className="text-helper text-muted-foreground">
                  <span className="font-medium text-foreground">{p.term}</span> — {p.text}
                </p>
              ))}
            </div>
          )}
          <div className="flex justify-end pt-1">
            <Button size="xs" onClick={onDismiss}>Got It</Button>
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
}
