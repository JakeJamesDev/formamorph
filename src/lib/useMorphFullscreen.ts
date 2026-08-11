import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';

const ENTER_MS = 260;
const EXIT_MS = 190;
/** Decelerate: quick to leave the field, slow to settle at full size. */
const EASE = 'cubic-bezier(0.2, 0, 0, 1)';

export type MorphPhase = 'closed' | 'entering' | 'open' | 'leaving';

/**
 * The transform that puts `box` exactly over `from`, so releasing it animates the box out to its real
 * size. Null when either rect has no area — a hidden or unlaid-out element would otherwise scale to zero
 * and never come back.
 */
function invertOnto(box: HTMLElement, from: DOMRect): string | null {
  const to = box.getBoundingClientRect();
  if (!to.width || !to.height || !from.width || !from.height) return null;
  return `translate(${from.left - to.left}px, ${from.top - to.top}px)`
    + ` scale(${from.width / to.width}, ${from.height / to.height})`;
}

export interface MorphFullscreen {
  /** Whether the overlay should be in the tree. Stays true through the closing animation. */
  mounted: boolean;
  phase: MorphPhase;
  open: () => void;
  close: () => void;
  toggle: () => void;
  /** Goes on the overlay's own box — the element that grows out of the source and shrinks back into it. */
  boxRef: (element: HTMLElement | null) => void;
  /** Goes on whatever sits inside that box. Fades rather than scaling, since a container transform that
   *  scales its own contents reads as the text stretching. */
  contentClassName: string;
}

/**
 * Grow an overlay out of the element it was opened from, and shrink it back in on the way out.
 *
 * A FLIP: the overlay is laid out at its real size, then transformed back onto the source rect and
 * released, so only `transform` animates. The source stays mounted underneath the whole time, which is
 * what makes the return trip measurable rather than remembered.
 *
 * Under `prefers-reduced-motion`, or with nothing measurable to grow from, it degrades to a plain
 * mount — the overlay still opens, just without travelling.
 */
export function useMorphFullscreen(sourceRef: RefObject<HTMLElement | null>): MorphFullscreen {
  const reduceMotion = usePrefersReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<MorphPhase>('closed');
  const boxEl = useRef<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frame = useRef<number | null>(null);

  /** Drop any trip still in flight. Refs only, so it never needs to change identity. */
  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    timer.current = null;
    frame.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  const open = useCallback(() => { stop(); setMounted(true); setPhase('entering'); }, [stop]);
  const close = useCallback(() => {
    stop();
    setPhase((current) => (current === 'closed' ? current : 'leaving'));
  }, [stop]);
  const toggle = useCallback(() => {
    if (phase === 'closed' || phase === 'leaving') open();
    else close();
  }, [phase, open, close]);

  /** Land on the end state and clear anything the trip left on the box. In a ref so the timeout that
   *  fires it never has to be re-created when it changes identity. */
  const settleRef = useRef((leaving: boolean) => {
    const box = boxEl.current;
    if (box) { box.style.transition = ''; box.style.transform = ''; box.style.transformOrigin = ''; }
    if (leaving) { setMounted(false); setPhase('closed'); } else setPhase('open');
  });

  /** Run the trip for `leaving`, given the box is attached. Returns false when there is nothing to
   *  travel between, so the caller can land on the end state instead. */
  const travel = useCallback((leaving: boolean): boolean => {
    const box = boxEl.current;
    const from = sourceRef.current?.getBoundingClientRect();
    const inverted = box && from ? invertOnto(box, from) : null;
    if (!box || !inverted || reduceMotion) return false;

    const ms = leaving ? EXIT_MS : ENTER_MS;
    box.style.transformOrigin = 'top left';
    box.style.transition = 'none';
    box.style.transform = leaving ? 'none' : inverted;
    void box.offsetWidth;

    // The release waits for a painted frame rather than following in this one: a transition declared
    // alongside an element's first style computation does not run, and the overlay was portaled in only
    // moments ago.
    const release = () => {
      box.style.transition = `transform ${ms}ms ${EASE}`;
      box.style.transform = leaving ? inverted : 'none';
    };
    frame.current = requestAnimationFrame(() => { frame.current = requestAnimationFrame(release); });

    // Armed here rather than inside `release`, and on a clock rather than `transitionend`: a hidden tab
    // suspends frames altogether, so a settle that waited on the release would never come and the overlay
    // would sit parked over the field for good. Landing early costs the animation, not the end state.
    timer.current = setTimeout(() => settleRef.current(leaving), ms + 100);
    return true;
  }, [reduceMotion, sourceRef]);

  /** Set when the trip was asked for before the overlay existed to run it. */
  const awaitingBox = useRef(false);

  useLayoutEffect(() => {
    if (phase !== 'entering' && phase !== 'leaving') return;
    const leaving = phase === 'leaving';
    // Entering, the overlay is portaled in by the dialog primitive and its ref lands *after* this effect,
    // so there is usually nothing here yet to measure. The trip then starts from the ref callback instead
    // — which is why opening used to skip the animation while closing, whose box was long since attached,
    // ran it correctly.
    if (!boxEl.current && !leaving) { awaitingBox.current = true; return; }
    if (!travel(leaving)) settleRef.current(leaving);
    return stop;
  }, [phase, travel, stop]);

  const boxRef = useCallback((element: HTMLElement | null) => {
    boxEl.current = element;
    if (!element || !awaitingBox.current) return;
    awaitingBox.current = false;
    if (!travel(false)) settleRef.current(false);
  }, [travel]);

  const contentClassName = phase === 'leaving'
    ? 'animate-out fade-out-0 duration-150 fill-mode-both'
    : phase === 'entering'
      ? 'animate-in fade-in-0 duration-200 delay-100 fill-mode-both'
      : '';

  return {
    mounted,
    phase,
    open,
    close,
    toggle,
    boxRef,
    contentClassName,
  };
}
