import { useEffect, useRef, useState, type FocusEvent, type HTMLAttributes } from 'react';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import { cn } from '@/lib/utils';

/** How long the pill stays up after the window opens, and after the pointer or focus leaves it. */
export const PILL_FADE_DELAY_MS = 1000;

/** What a faded piece needs: the state it reports, its look, and the handlers that wake it. */
export type PillFadeProps = Pick<HTMLAttributes<HTMLElement>, 'onPointerEnter' | 'onPointerLeave' | 'onFocus' | 'onBlur'> & {
  className: string;
  'data-fq-fade': 'shown' | 'hidden';
};

export interface PillFade {
  /** For each piece that fades: the pill and her grip. */
  props: PillFadeProps;
  /** For the pill's ⋮ menu, which holds the pill up while it is open. */
  onMenuOpenChange: (open: boolean) => void;
}

/** True for focus a keyboard put there. A press on a button also focuses it, and that must not hold the pill up. */
function keyboardFocus(event: FocusEvent<HTMLElement>): boolean {
  try {
    return event.target.matches(':focus-visible');
  } catch {
    return true;
  }
}

/**
 * The fade of the pill over her head and of her grip (Q5, Q19). Both show when the window opens, hide after
 * {@link PILL_FADE_DELAY_MS}, and return while the pointer is over her or a faded piece, keyboard focus is
 * inside one, or the pill's menu is open; leaving starts the delay again. A hidden piece takes no presses, so
 * the pointer reaches her body under it and wakes the piece. Returns null where nothing fades: head view, a
 * touch screen. Reduced motion hides and shows with no transition.
 */
export function usePillFade(enabled: boolean): PillFade | null {
  const touch = useMediaQuery('(pointer: coarse)');
  const reduced = usePrefersReducedMotion();
  const [pointer, setPointer] = useState(false);
  const [focus, setFocus] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [idle, setIdle] = useState(false);
  const fades = enabled && !touch;
  const held = pointer || focus || menuOpen;

  useEffect(() => {
    setIdle(false);
    // With no handlers attached, a leave or blur can't arrive; drop what the last hover or focus left.
    if (!fades) { setPointer(false); setFocus(false); setMenuOpen(false); }
    if (!fades || held) return;
    const timer = window.setTimeout(() => setIdle(true), PILL_FADE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [fades, held]);

  if (!fades) return null;
  const hidden = idle && !held;
  return {
    props: {
      className: cn(hidden && 'opacity-0 !pointer-events-none', !reduced && 'transition-opacity duration-300'),
      'data-fq-fade': hidden ? 'hidden' : 'shown',
      onPointerEnter: () => setPointer(true),
      onPointerLeave: () => setPointer(false),
      onFocus: (event) => { if (keyboardFocus(event)) setFocus(true); },
      onBlur: () => setFocus(false),
    },
    // The menu unmounts under the pointer and its focus with no leave or blur event, so their hold ends with the menu.
    onMenuOpenChange: (open) => {
      setMenuOpen(open);
      if (!open) { setPointer(false); setFocus(false); }
    },
  };
}

/** What a handle that shows on hover needs: its state, its look, and the handlers that reveal it. */
export interface HoverReveal {
  className: string;
  'data-fq-fade': 'shown' | 'hidden';
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}

/**
 * Hover-revealed marks, one per key, as the resize handles use: a mark shows while the pointer is over its handle
 * and hides {@link PILL_FADE_DELAY_MS} after it leaves, with the pill's transition. `always` keys stay shown, for a
 * touch screen with no hover; `never` keys stay hidden. The pointer is over one handle at a time, so one key holds.
 */
export function useHoverReveal<Key extends string>(always: readonly Key[], never: readonly Key[]): (key: Key) => HoverReveal {
  const reduced = usePrefersReducedMotion();
  const [hot, setHot] = useState<Key | null>(null);
  const timer = useRef<number | null>(null);
  const clear = () => { if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null; } };
  useEffect(() => clear, []);
  return (key) => {
    const shown = always.includes(key) || (hot === key && !never.includes(key));
    return {
      className: cn(!shown && 'opacity-0', !reduced && 'transition-opacity duration-300'),
      'data-fq-fade': shown ? 'shown' : 'hidden',
      onPointerEnter: () => { clear(); setHot(key); },
      onPointerLeave: () => { clear(); timer.current = window.setTimeout(() => { timer.current = null; setHot((current) => (current === key ? null : current)); }, PILL_FADE_DELAY_MS); },
    };
  };
}
