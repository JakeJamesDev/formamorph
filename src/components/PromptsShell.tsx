import type { ReactNode, RefObject } from 'react';
import { FullscreenShell } from '@/components/FullscreenShell';
import type { MorphFullscreen } from '@/lib/useMorphFullscreen';

/** The toggles a hosted field renders, either of which can take focus back after the window closes. */
const FULLSCREEN_TOGGLE = 'button[aria-label="Edit full screen"], button[aria-label="View full screen"]';
/** The rail row on screen: where focus goes when the panel closed on a view with no toggle. */
const CURRENT_ROW = '[aria-current="true"]';

/**
 * A whole panel, either in place or filling the screen. Fullscreen belongs to the panel rather than to
 * PromptField so the rail and the footer come with it: the editor alone in a full-screen window loses the
 * navigation that makes a long prompt findable.
 *
 * The caller owns the morph and hands its fields `morph.contentInOverlay` as their fullscreen flag and
 * `morph.toggle` as their request. Toggling re-parents the panel into the overlay, so the editor is
 * rebuilt from its value: the text is safe (it is controlled) but the undo stack starts fresh on either
 * side of the toggle.
 */
export function PromptsShell({ morph, sourceRef, title, children }: {
  morph: MorphFullscreen;
  /** The window's name: the tab it grows out of. */
  title: string;
  /** The panel the shell sits in. The window grows out of it, and focus returns to a toggle inside it. */
  sourceRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  if (!morph.mounted) return <>{children}</>;
  // A panel, not a field: nothing inside it carries a caption, so this window names itself. While closing,
  // the children are already back in the panel and the shell above them is just the fading sheet.
  return (
    <>
      {!morph.contentInOverlay && children}
      <FullscreenShell
        morph={morph}
        title={title}
        showTitle
        returnFocus={() => sourceRef.current?.querySelector<HTMLElement>(FULLSCREEN_TOGGLE) ?? sourceRef.current?.querySelector<HTMLElement>(CURRENT_ROW)}
      >
        {morph.contentInOverlay ? children : null}
      </FullscreenShell>
    </>
  );
}

export default PromptsShell;
