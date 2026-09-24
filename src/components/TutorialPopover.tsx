import { useMemo, useState, type ReactNode } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { Popover, PopoverAnchor, PopoverArrow, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import { useAnchorCovered } from '@/lib/useAnchorCovered';
import type { TutorialEntry, TutorialNav } from '@/lib/tutorials';

type Side = 'top' | 'bottom' | 'left' | 'right';
type Align = 'start' | 'center' | 'end';

/**
 * The tutorial layer's note: an explanation beside a control, with the buttons its caller supplies.
 *
 * It anchors either to `children`, which it wraps, or to an `anchor` element found elsewhere in the page.
 * `open` is fully controlled with no `onOpenChange`, so Radix's own dismissals (outside click, Escape) can't
 * close it, and a stray click can't silently retire a note the user never read.
 */
export function TutorialNote({ open, title, body, points, action, footer, anchor, side = 'bottom', align = 'end', width = 'w-72', children }: {
  open: boolean;
  title: string;
  body?: ReactNode;
  points?: { term: string; text: string }[];
  /** A full-width control above the footer row. */
  action?: ReactNode;
  footer: ReactNode;
  /** An element to point at in place of wrapping `children`. */
  anchor?: HTMLElement | null;
  side?: Side;
  align?: Align;
  /** A Tailwind width class for the note. */
  width?: string;
  children?: ReactNode;
}) {
  const reduceMotion = usePrefersReducedMotion();
  // Stand down while a dialog covers the control: the popover is portaled to <body>, so nothing else
  // hides it, and it would go on pointing at something the reader can no longer see. It is not marked
  // read — it comes back once the control does.
  const [wrapped, setWrapped] = useState<HTMLElement | null>(null);
  const target = anchor === undefined ? wrapped : anchor;
  const covered = useAnchorCovered(target, open);
  const virtualRef = useMemo(() => ({ current: anchor ?? null }), [anchor]);
  const shown = open && !!target && !covered;
  return (
    <Popover open={shown}>
      {anchor === undefined ? (
        <PopoverAnchor asChild>
          <Slot ref={setWrapped}>{children}</Slot>
        </PopoverAnchor>
      ) : (
        <PopoverAnchor virtualRef={virtualRef} />
      )}
      {shown && (
        <PopoverContent
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={12}
          // The app's <body> is a zero-height fixed-layout shell, so the default clipping-ancestor
          // boundary reports no room anywhere and flips the popover off the top of the screen.
          collisionBoundary={typeof document === 'undefined' ? undefined : document.documentElement}
          role="dialog"
          aria-label={title}
          onOpenAutoFocus={(e) => e.preventDefault()}
          // Radix portals this to <body>, but React events bubble the React tree, not the DOM — so a
          // tutorial anchored inside a clickable ancestor hands it every click on Next.
          onClick={(e) => e.stopPropagation()}
          className={`${width} space-y-2 ${reduceMotion ? 'animate-none' : ''}`}
        >
          <PopoverArrow />
          <p className="font-medium leading-none">{title}</p>
          {body && <p className="text-helper text-muted-foreground">{body}</p>}
          {points && (
            <div className="space-y-1">
              {points.map((p) => (
                <p key={p.term} className="text-helper text-muted-foreground">
                  <span className="font-medium text-foreground">{p.term}</span> — {p.text}
                </p>
              ))}
            </div>
          )}
          {action && <div className="pt-1">{action}</div>}
          <div className="flex items-center justify-end gap-2 pt-1">{footer}</div>
        </PopoverContent>
      )}
    </Popover>
  );
}

/**
 * Wraps the control a tutorial explains and shows the explanation beside it. Only its button or engaging
 * with the control itself retires it.
 *
 * An entry with a second action shows both, and either one retires the note after its callback runs.
 */
export function TutorialPopover({ entry, nav, side = 'bottom', align = 'end', anchor, onPrimary, onSecondary, children }: {
  entry: TutorialEntry | null;
  nav: TutorialNav;
  side?: Side;
  align?: Align;
  /** An element to point at in place of wrapping `children`. */
  anchor?: HTMLElement | null;
  /** Returns false when the action did not happen yet, so the note stays unread. */
  onPrimary?: () => boolean | void;
  onSecondary?: () => void;
  children?: ReactNode;
}) {
  const isTour = nav.total > 1;
  const isLast = nav.step >= nav.total;
  const primary = () => { if (onPrimary?.() !== false) nav.next(); };
  const secondary = () => { onSecondary?.(); nav.next(); };
  return (
    <TutorialNote
      open={!!entry}
      title={entry?.title ?? ''}
      body={entry?.body}
      points={entry?.points}
      anchor={anchor}
      side={side}
      align={align}
      footer={(
        <>
          {/* A lone explanation keeps the single button: there is nowhere to step back to, and a count
              of one says nothing. */}
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
          {entry?.secondaryLabel && (
            <Button size="xs" variant="ghost" onClick={secondary}>{entry.secondaryLabel}</Button>
          )}
          <Button size="xs" onClick={primary}>
            {isTour && !isLast ? 'Next' : entry?.primaryLabel ?? 'Got It'}
          </Button>
        </>
      )}
    >
      {children}
    </TutorialNote>
  );
}
