import type { ReactNode, RefObject } from 'react';
import { FullscreenShell } from '@/components/FullscreenShell';
import type { MorphFullscreen } from '@/lib/useMorphFullscreen';

/**
 * Where focus goes after the window closes, best first: a full-screen toggle, the rail row on screen when
 * the panel closed on a view with no toggle, then the narrow header's ⋯ menu that holds the toggle there.
 */
const RETURN_TARGETS = [
  'button[aria-label="Edit full screen"], button[aria-label="View full screen"]',
  '[aria-current="true"]',
  'button[aria-label="Preset Actions"]',
];

/** False for a control the breakpoint hides; true where the browser cannot tell. */
const shown = (element: HTMLElement) => element.checkVisibility?.() ?? true;

/** The first shown return target inside `root`. */
function returnTarget(root: HTMLElement | null): HTMLElement | undefined {
  for (const selector of RETURN_TARGETS) {
    const hit = [...root?.querySelectorAll<HTMLElement>(selector) ?? []].find(shown);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * A whole panel, either in place or filling the screen. Fullscreen belongs to the panel rather than to one
 * field, so the panel's header, navigation and footer come with it.
 *
 * The caller owns the morph and hands its toggles `morph.contentInOverlay` as their fullscreen flag and
 * `morph.toggle` as their request. Toggling re-parents the panel into the overlay, so its controls are
 * rebuilt from their values: controlled state is safe, but a field's own undo stack starts fresh on either
 * side of the toggle.
 */
export function PanelShell({ morph, sourceRef, title, showTitle = true, children }: {
  morph: MorphFullscreen;
  /** The window's name: the tab it grows out of. */
  title: string;
  /** False keeps the title as the accessible name and spends no row on it; the panel's own toggle is the way out. */
  showTitle?: boolean;
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
      <FullscreenShell morph={morph} title={title} showTitle={showTitle} returnFocus={() => returnTarget(sourceRef.current)}>
        {morph.contentInOverlay ? children : null}
      </FullscreenShell>
    </>
  );
}

export default PanelShell;
