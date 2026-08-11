import { useState, type ReactNode } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { Popover, PopoverAnchor, PopoverArrow, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import { useAnchorCovered } from '@/lib/useAnchorCovered';
import type { TutorialEntry, TutorialNav } from '@/lib/tutorials';

/**
 * Wraps the control a tutorial explains and shows the explanation beside it. `open` is fully controlled
 * with no `onOpenChange`, so Radix's own dismissals (outside click, Escape) can't close it — only the
 * button or engaging with the control itself counts, and a stray click can't silently retire an
 * explanation the user never read.
 */
export function TutorialPopover({ entry, nav, side = 'bottom', align = 'end', children }: {
  entry: TutorialEntry | null;
  nav: TutorialNav;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  children: ReactNode;
}) {
  const isTour = nav.total > 1;
  const isLast = nav.step >= nav.total;
  const reduceMotion = usePrefersReducedMotion();
  // Stand down while a dialog covers the control: the popover is portaled to <body>, so nothing else
  // hides it, and it would go on pointing at something the reader can no longer see. It is not marked
  // read — it comes back once the control does.
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const covered = useAnchorCovered(anchor, !!entry);
  return (
    <Popover open={!!entry && !covered}>
      <PopoverAnchor asChild>
        <Slot ref={setAnchor}>{children}</Slot>
      </PopoverAnchor>
      {entry && !covered && (
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
          // Radix portals this to <body>, but React events bubble the React tree, not the DOM — so a
          // tutorial anchored inside a clickable ancestor hands it every click on Next.
          onClick={(e) => e.stopPropagation()}
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
          {/* A lone explanation keeps the single button: there is nowhere to step back to, and a count
              of one says nothing. */}
          <div className="flex items-center justify-end gap-2 pt-1">
            {isTour && (
              <>
                <span className="mr-auto text-meta text-muted-foreground tabular-nums">
                  {nav.step} / {nav.total}
                </span>
                {/* "Previous", not "Back": screens that host a tour have their own Back control, and two
                    of them differ only in whether they leave the screen. */}
                <Button size="xs" variant="ghost" onClick={nav.prev} disabled={nav.step === 1}>Previous</Button>
              </>
            )}
            <Button size="xs" onClick={nav.next}>{isTour && !isLast ? 'Next' : 'Got It'}</Button>
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
}
