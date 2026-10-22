import { useRef, type ReactNode } from 'react';
import { Minimize2, X } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, dialogCornerButton, dialogFullHeight } from '@/components/ui/dialog';
import { Tip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { MorphFullscreen } from '@/lib/useMorphFullscreen';

/** Keeps a row that reaches the window's top edge clear of the corner button. */
export const FULLSCREEN_CORNER_CLEAR = 'pr-9';

/**
 * The window an editor opens into when it goes full screen.
 *
 * Shared so the surfaces that offer full screen cannot drift apart again — they were four hand-rolled
 * copies disagreeing on the header, the close button and the animation. Everything specific to one of
 * them arrives as `title` and `children`.
 *
 * The way out is the shell's own button, in the corner every dialog keeps its close in. The surfaces drop
 * their toggle while in here, and the row that reaches the top edge takes `FULLSCREEN_CORNER_CLEAR`.
 */
export function FullscreenShell({ morph, title, showTitle = false, returnFocus, worldWindow = false, closes = false, className, children }: {
  morph: MorphFullscreen;
  /** Always the window's accessible name; rendered as a header row only with `showTitle`. */
  title: string;
  /**
   * Give the window a visible heading. Only for content that has no caption of its own — a markdown
   * field, whose formatting toolbar takes the slot its label would sit in, or a whole panel. A field
   * that already names itself in its toolbar would just say it twice and spend a row doing it.
   */
  showTitle?: boolean;
  /** Where focus should land after closing when the control that opened the window no longer exists —
   *  callers that move their content into the overlay destroy that control on the way in. */
  returnFocus?: () => HTMLElement | null | undefined;
  /** The window edits the world, so the World Editor's undo and redo chords stay live in it. */
  worldWindow?: boolean;
  /** The window is the whole surface, not a bigger view of one, so its corner button closes it. */
  closes?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const returnFocusTo = useRef<HTMLElement | null>(null);
  return (
    <Dialog open={morph.mounted} onOpenChange={(next) => { if (!next) morph.close(); }}>
      <DialogContent
        ref={morph.boxRef}
        unanimated
        hideClose
        overlayClassName={morph.overlayClassName}
        aria-describedby={undefined}
        data-world-window={worldWindow || undefined}
        // Focus is moved by hand, without scrolling. Left to the dialog primitive it lands on the first
        // control inside the window — and since the window opens sitting on top of the field it came from,
        // which may be well down a scrolled panel, revealing that control drags the page with it. Closing
        // did the same in reverse, restoring focus to the button that opened it.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          // `body` is what activeElement reports when nothing is focused — remembering it would make the
          // close path "restore" focus to nowhere and skip the fallback, since body is always connected.
          const active = document.activeElement as HTMLElement | null;
          returnFocusTo.current = active && active !== document.body ? active : null;
          (event.currentTarget as HTMLElement).focus({ preventScroll: true });
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          // The remembered element is often gone by now: a field that moved its body into the overlay
          // destroyed its own toolbar on the way in. Falling back matters — focus left on nothing gets
          // yanked by the host dialog's focus trap to whatever control it likes, wherever that is.
          const remembered = returnFocusTo.current;
          if (remembered?.isConnected) return remembered.focus({ preventScroll: true });
          // Deferred a tick: this event fires while the overlay is still being torn down, before the
          // caller's inline content is back in the tree — queried now, the control does not exist yet.
          if (returnFocus) setTimeout(() => returnFocus()?.focus?.({ preventScroll: true }), 0);
        }}
        className={cn(
          'flex flex-col gap-4 overflow-hidden border-0 p-4',
          dialogFullHeight,
          'w-screen max-w-none left-0 translate-x-0 rounded-none sm:rounded-none',
          morph.boxClassName,
          className,
        )}
      >
        <div className="flex flex-col flex-1 min-h-0 gap-4">
          {/* The title is always here, only sometimes seen: a dialog without one is unnamed to a screen
              reader, and `sr-only` keeps that promise without spending the row. At the size of a field
              caption when shown, not a dialog heading — it names a box inside the app. */}
          {/* Centered on mobile, so the gutter goes on both sides there. */}
          <DialogHeader className={cn(FULLSCREEN_CORNER_CLEAR, 'max-sm:pl-9', !showTitle && 'sr-only')}>
            <DialogTitle className="text-label">{title}</DialogTitle>
          </DialogHeader>
          {children}
        </div>
        <Tip tip={closes ? 'Close (Esc)' : 'Exit full screen'}>
          <DialogClose aria-label={closes ? `Close ${title}` : 'Exit full screen'} className={cn(dialogCornerButton, 'z-[5]')}>
            {closes ? <X aria-hidden className="h-5 w-5" /> : <Minimize2 aria-hidden className="h-5 w-5" />}
          </DialogClose>
        </Tip>
        {/* The solid sheet over the contents. The widget beneath it is laid out at full size and never
            animates; the traveling box shows only this panel, and the reveal is the sheet fading away
            once the box has landed. `inset-0` deliberately covers the box's padding too. */}
        <div aria-hidden className={cn('pointer-events-none absolute inset-0 z-10 bg-background', morph.veilClassName)} />
      </DialogContent>
    </Dialog>
  );
}

export default FullscreenShell;
