import { useRef, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, dialogFullHeight } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { MorphFullscreen } from '@/lib/useMorphFullscreen';

/**
 * The window an editor opens into when it goes full screen.
 *
 * Shared so the surfaces that offer full screen cannot drift apart again — they were four hand-rolled
 * copies disagreeing on the header, the close button and the animation. Everything specific to one of
 * them arrives as `title` and `children`.
 *
 * There is no close button: the full-screen toggle in the field's own toolbar is the way back out, and a
 * second control in the corner meaning the same thing reads as a different one. Escape still works, since
 * the dialog primitive owns it.
 */
export function FullscreenShell({ morph, title, showTitle = false, returnFocus, className, children }: {
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
        aria-describedby={undefined}
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
          className,
        )}
      >
        {/* Fades in over the growing box rather than being scaled with it, which would read as the
            contents stretching back to size. */}
        <div className={cn('flex flex-col flex-1 min-h-0 gap-4', morph.contentClassName)}>
          {/* The title is always here, only sometimes seen: a dialog without one is unnamed to a screen
              reader, and `sr-only` keeps that promise without spending the row. At the size of a field
              caption when shown, not a dialog heading — it names a box inside the app. */}
          <DialogHeader className={cn(!showTitle && 'sr-only')}>
            <DialogTitle className="text-label">{title}</DialogTitle>
          </DialogHeader>
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default FullscreenShell;
