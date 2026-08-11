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

/**
 * FLIP one element across a layout change of its own — the same trip, for a box that grows in place
 * instead of being raised over the thing it came from. `key` names the layout: when it changes, the
 * element animates from the rect it had under the previous one.
 *
 * Separate from `useMorphFullscreen` because there is no source to measure here. The old rect has to be
 * captured before React commits the new layout, which only a render-time read can do.
 */
export function useMorphResize(key: string | number): (element: HTMLElement | null) => void {
  const reduceMotion = usePrefersReducedMotion();
  const el = useRef<HTMLElement | null>(null);
  const previous = useRef<{ key: string | number; rect: DOMRect } | null>(null);
  const frame = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Read during render, before the commit that applies the new layout — by the layout effect the element
  // has already been resized and its old rect is gone.
  if (el.current && previous.current?.key !== key) {
    previous.current = { key, rect: el.current.getBoundingClientRect() };
  }

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useLayoutEffect(() => {
    const box = el.current;
    const from = previous.current?.rect;
    if (!box || !from || reduceMotion) return;
    // Before measuring: anything a previous trip left on the element would be read back as if it were the
    // element's own resting position.
    const base = baseTransform(box);
    const inverted = invertOnto(box, from);
    if (!inverted) return;

    box.style.transformOrigin = 'top left';
    box.style.transition = 'none';
    box.style.transform = withBase(base, inverted);
    void box.offsetWidth;

    frame.current = requestAnimationFrame(() => {
      frame.current = requestAnimationFrame(() => {
        box.style.transition = `transform ${ENTER_MS}ms ${EASE}`;
        box.style.transform = withBase(base, '');
      });
    });
    timer.current = setTimeout(() => {
      box.style.transition = '';
      box.style.transform = '';
      box.style.transformOrigin = '';
    }, ENTER_MS + 100);
  }, [key, reduceMotion]);

  return useCallback((element: HTMLElement | null) => { el.current = element; }, []);
}

/**
 * The transform the element already carries from its own styles, cleared of anything a previous trip left.
 *
 * A dialog in its windowed state is centered *by* a transform (`translate(-50%, -50%)`), so a trip that
 * simply assigned `transform` threw the centering away and dropped the box at the raw `left:50%/top:50%`
 * corner until the animation finished.
 */
function baseTransform(el: HTMLElement): string {
  el.style.transform = '';
  const base = getComputedStyle(el).transform;
  return base && base !== 'none' ? base : '';
}

/**
 * Compose the trip with that base. The base goes first, so it is applied *outermost*: the element is
 * positioned as its styles intend, and the trip then moves it from there. The other order scales the
 * centering offset along with the box and lands it somewhere else entirely.
 */
const withBase = (base: string, trip: string): string => [base, trip].filter(Boolean).join(' ') || 'none';

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

  /**
   * Where the trip starts and ends, taken as the toggle is pressed rather than read when the trip runs.
   * Some callers hand their editor to the overlay instead of leaving a copy behind, so by the time the
   * return trip is measured the source is gone; the remembered rect is all there is. Callers whose source
   * survives re-take it on the way out, so a scroll between the two never strands the animation.
   */
  const sourceRect = useRef<DOMRect | null>(null);
  const snapshot = useCallback(() => {
    const source = sourceRef.current;
    // A source that now sits *inside* the overlay is the editor itself, handed over on the way in. Measuring
    // it here would report the overlay's own rect, the trip would invert onto where it already is, and the
    // close would collapse to the content fade with nothing travelling. The rect taken on the way in is the
    // real one.
    if (!source || boxEl.current?.contains(source)) return;
    const rect = source.getBoundingClientRect();
    if (rect.width && rect.height) sourceRect.current = rect;
  }, [sourceRef]);

  /**
   * Where every panel behind the window was scrolled to when it opened, so closing can put them back.
   *
   * Restoring rather than preventing, deliberately: the window closing moves focus, and focus moves scroll
   * — through the host dialog's focus trap, through the browser's own reveal-the-focused-element, and
   * animated by whatever `scroll-behavior` the panel carries. Those are several actors, none of them ours,
   * and `preventScroll` only covers the focus calls we make. Where the author was reading is knowable, so
   * it is simply restored.
   */
  const scrollAnchors = useRef<{ el: HTMLElement; top: number; left: number }[]>([]);
  const captureScrollers = useCallback(() => {
    const anchors: { el: HTMLElement; top: number; left: number }[] = [];
    for (let node = sourceRef.current?.parentElement; node; node = node.parentElement) {
      if (node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1) {
        anchors.push({ el: node, top: node.scrollTop, left: node.scrollLeft });
      }
    }
    scrollAnchors.current = anchors;
  }, [sourceRef]);

  const restoreScrollers = useCallback(() => {
    for (const { el, top, left } of scrollAnchors.current) {
      if (!el.isConnected || (el.scrollTop === top && el.scrollLeft === left)) continue;
      // A panel with `scroll-behavior: smooth` would animate the correction too, and animating back from a
      // jump is still a jump. Put it back instantly, then hand the behavior back.
      const behavior = el.style.scrollBehavior;
      el.style.scrollBehavior = 'auto';
      el.scrollTop = top;
      el.scrollLeft = left;
      el.style.scrollBehavior = behavior;
    }
  }, []);

  const open = useCallback(() => {
    captureScrollers();
    snapshot();
    stop();
    setMounted(true);
    setPhase('entering');
  }, [captureScrollers, snapshot, stop]);
  const close = useCallback(() => {
    snapshot();
    stop();
    setPhase((current) => (current === 'closed' ? current : 'leaving'));
  }, [snapshot, stop]);
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
  // Held in a ref for the same reason, and re-pointed each render so it never closes over a stale capture.
  const restoreRef = useRef(restoreScrollers);
  restoreRef.current = restoreScrollers;

  /** Run the trip for `leaving`, given the box is attached. Returns false when there is nothing to
   *  travel between, so the caller can land on the end state instead. */
  const travel = useCallback((leaving: boolean): boolean => {
    const box = boxEl.current;
    const from = sourceRect.current;
    const base = box ? baseTransform(box) : '';
    const inverted = box && from ? invertOnto(box, from) : null;
    if (!box || !inverted || reduceMotion) return false;

    const ms = leaving ? EXIT_MS : ENTER_MS;
    box.style.transformOrigin = 'top left';
    box.style.transition = 'none';
    box.style.transform = withBase(base, leaving ? '' : inverted);
    void box.offsetWidth;

    // The release waits for a painted frame rather than following in this one: a transition declared
    // alongside an element's first style computation does not run, and the overlay was portaled in only
    // moments ago.
    const release = () => {
      box.style.transition = `transform ${ms}ms ${EASE}`;
      box.style.transform = withBase(base, leaving ? inverted : '');
    };
    frame.current = requestAnimationFrame(() => { frame.current = requestAnimationFrame(release); });

    // Armed here rather than inside `release`, and on a clock rather than `transitionend`: a hidden tab
    // suspends frames altogether, so a settle that waited on the release would never come and the overlay
    // would sit parked over the field for good. Landing early costs the animation, not the end state.
    timer.current = setTimeout(() => settleRef.current(leaving), ms + 100);
    return true;
  }, [reduceMotion]);

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

  // Closing hands focus around for several frames — the trap, the browser's reveal, a smooth `scroll-behavior`
  // still animating — so the panels are put back once the dust has settled rather than only on the first tick.
  useEffect(() => {
    if (phase !== 'closed' || !scrollAnchors.current.length) return;
    const run = () => restoreRef.current();
    run();
    const f = requestAnimationFrame(run);
    const t = setTimeout(run, 120);
    return () => { cancelAnimationFrame(f); clearTimeout(t); };
  }, [phase]);

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
