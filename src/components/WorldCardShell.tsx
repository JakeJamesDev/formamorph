import React, { forwardRef, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from '@/components/game/MarkdownRenderer';
import { Tip } from '@/components/ui/tooltip';
import { THUMB_FRAME } from '@/lib/thumbAspect';

/** The scrim behind a name laid over tile art: a smooth black fade, the same in both themes. */
export const TITLE_SCRIM = 'bg-gradient-to-t from-black/80 via-black/40 to-transparent';

/** How many lines a hovered name may take. Must match the `line-clamp-*` class below. */
const TITLE_MAX_LINES = 3;

/**
 * A card name over the art: one line until the card (a `group`) is hovered, then it slides up to
 * show up to three lines. A name still clipped at three lines carries the full text as a tip.
 */
export function OverlayTitle({ name, className }: { name: string; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [clipped, setClipped] = useState(false);
  // Multi-line mode. Entered on card hover; left only when the collapse transition finishes, so
  // the exit animates instead of the clamp snapping the text to one line while max-height is
  // still on its way down.
  const [reveal, setReveal] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const card = el.closest('.group');
    const enter = () => setReveal(true);
    // Without a transition (reduced motion) there is no transitionend, so leave resets directly.
    const leave = () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setReveal(false);
    };
    card?.addEventListener('pointerenter', enter);
    card?.addEventListener('pointerleave', leave);
    const measure = () => {
      const style = getComputedStyle(el);
      const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5;
      // scrollHeight sees past the clamp, so this is the full wrapped height. The measured
      // endpoints go into the max-height vars, so the slide covers the exact distance and every
      // name plays the full easing curve; the clamp still draws the line boundaries and ellipsis.
      el.style.setProperty('--title-collapsed', `${lineHeight}px`);
      el.style.setProperty('--title-expanded', `${Math.min(el.scrollHeight, lineHeight * TITLE_MAX_LINES)}px`);
      setClipped(el.scrollHeight > lineHeight * TITLE_MAX_LINES + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
      card?.removeEventListener('pointerenter', enter);
      card?.removeEventListener('pointerleave', leave);
    };
  }, [name]);
  return (
    <Tip tip={clipped ? name : undefined} labelsChild={false}>
      <h3
        ref={ref}
        // Until the first measure sets the vars, max-height resolves to none and the clamp alone
        // clips — so there is no flash, just no slide yet.
        className={cn(
          'font-semibold text-white break-words max-h-[var(--title-collapsed)]',
          reveal ? 'line-clamp-3' : 'line-clamp-1',
          // easeOutExpo, as arbitrary properties: this config overloads duration-/ease-, so those
          // utility forms are ambiguous and emit nothing.
          'transition-[max-height] [transition-duration:350ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none',
          'group-hover:max-h-[var(--title-expanded)]',
          className,
        )}
        onTransitionEnd={() => {
          if (!ref.current?.closest('.group')?.matches(':hover')) setReveal(false);
        }}
      >
        {name}
      </h3>
    </Tip>
  );
}

interface WorldCardShellProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The thumbnail image node (an `img`/`CachedThumbnail`); a `Globe` placeholder fills the area when absent. */
  thumbnail?: ReactNode;
  /** Absolutely-positioned overlay over the thumbnail (e.g. a download button / progress bar). */
  thumbnailOverlay?: ReactNode;
  /** Absolutely-positioned control in the card's top-right corner (hide / delete). */
  cornerAction?: ReactNode;
  name: string;
  description?: string;
  /** The author line — plain text, or an interactive element (e.g. a hide-author span). */
  author?: ReactNode;
  /** A line about the card's subject (e.g. a place badge), between the author and the card's own content. */
  note?: ReactNode;
  /** Surface/border variant classes for the frame (e.g. `bg-background`, the update highlight, `touch-none`). */
  frameClassName?: string;
}

/**
 * The shared visual shell for a world card — frame, thumbnail area (with a `Globe` fallback) carrying the
 * title and author over a scrim, and the description beneath — composed by both the local
 * `SortableWorldCard` (detailed layout) and the community `RemoteWorldCard`. Card-specific bits (drag vs.
 * download/hide, counts, tags, footer actions) are passed via slots/`children`, so the shared layout
 * **and its themed colors live in exactly one place.**
 * Forwards a ref + spreads the rest onto the frame so a caller can attach dnd-kit listeners / `onClick`.
 */
export const WorldCardShell = forwardRef<HTMLDivElement, WorldCardShellProps>(function WorldCardShell(
  { thumbnail, thumbnailOverlay, cornerAction, name, description, author, note, frameClassName, className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn('group relative flex flex-col rounded-lg border cursor-pointer', frameClassName, className)}
      {...rest}
    >
      {cornerAction}
      <div className={cn('relative bg-muted rounded-t-lg overflow-hidden', THUMB_FRAME.landscape)}>
        {thumbnailOverlay}
        {thumbnail ?? (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Globe className="h-12 w-12" />
          </div>
        )}
        {/* The name and author live on the art, matching the grid tiles, so the text block stays short. */}
        <div className={cn('absolute bottom-0 left-0 right-0 p-2 pt-8', TITLE_SCRIM)}>
          <OverlayTitle name={name} className="text-title" />
          {author != null && <div className="text-meta text-white/85">{author}</div>}
        </div>
      </div>
      <div className="p-4 flex flex-col flex-grow">
        <div className="text-helper text-muted-foreground mb-2 max-h-20 overflow-hidden">
          <MarkdownRenderer text={description || 'No description available.'} />
        </div>
        {note}
        {children}
      </div>
    </div>
  );
});
