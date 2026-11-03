import { useLayoutEffect, useRef, useState } from 'react';
import { DEFAULT_MASCOT_TRANSITION, jellyDipMs, mascotTransitionAt, type JellyTuning } from '@/lib/formaquestion/mascotTransition';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';

export const CHANGE_JELLY: JellyTuning = { durationMs: 560, squash: 0.2, overshoot: 0.16, settle: 2 };
export const ENTER_JELLY: JellyTuning = { durationMs: 480, squash: 0.14, overshoot: 0.09, settle: 2 };

/**
 * Plays a Jelly on the element holding `ref` at each change of `value`, and returns the new value at the dip.
 * Timers carry the swap and the rest, so a suspended frame can't strand the old value. A change mid-run starts
 * from the height on screen. Under reduced motion the value swaps at once.
 */
export function useMorphieJelly<T>(value: T, { enter = false }: { enter?: boolean } = {}) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const height = useRef(1);
  const entered = useRef(false);
  const [shown, setShown] = useState(value);

  useLayoutEffect(() => {
    const tuning = entered.current ? CHANGE_JELLY : enter ? ENTER_JELLY : null;
    if (!tuning) return;
    const element = ref.current;
    if (!element || reduced) {
      if (element) element.style.transform = '';
      height.current = 1;
      setShown(value);
      return;
    }
    const transition = { ...DEFAULT_MASCOT_TRANSITION, mode: 'jelly' as const, jelly: tuning };
    const from = height.current;
    const start = performance.now();
    let frame = 0;
    const tick = () => {
      const at = mascotTransitionAt(performance.now() - start, transition, from);
      element.style.transform = `scale(${at.scaleX}, ${at.scaleY})`;
      height.current = at.scaleY;
      if (!at.done) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const swap = setTimeout(() => setShown(value), jellyDipMs(tuning));
    const rest = setTimeout(() => {
      cancelAnimationFrame(frame);
      element.style.transform = '';
      height.current = 1;
    }, tuning.durationMs + 40);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(swap);
      clearTimeout(rest);
    };
    // A run starts on a new value only; the rest is read as it stands then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Declared after the run, so the first run sees false, also on a StrictMode remount.
  useLayoutEffect(() => {
    entered.current = true;
    return () => { entered.current = false; };
  }, []);

  return { ref, shown };
}
