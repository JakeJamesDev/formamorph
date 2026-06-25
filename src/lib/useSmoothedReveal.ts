import { useCallback, useEffect, useRef } from 'react';

const CATCHUP = 0.08; // fraction of the outstanding gap revealed per frame while streaming
const DONE_CATCHUP = 0.25; // faster catch-up once the stream has ended, to finish promptly
const MIN_STEP = 1; // minimum chars per frame, so it always finishes

/**
 * Smoothly reveals streamed text into `onText`, self-pacing to the rate it arrives (revealing a
 * fraction of the outstanding gap each animation frame) and always trailing the latest target — so
 * an incomplete trailing sentence is never shown and a late truncation trim happens off-screen.
 *
 * Drive it with `push(target)` as tokens arrive, `finish(finalText)` when the stream ends (pass the
 * final, possibly-trimmed text), and `reset()` at the start of each turn.
 */
export function useSmoothedReveal(onText: (text: string) => void) {
  const targetRef = useRef('');
  const shownRef = useRef(0);
  const doneRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const tick = useCallback(() => {
    const target = targetRef.current;
    const gap = target.length - shownRef.current;
    if (gap > 0) {
      // Reveal a fraction of the outstanding gap each frame: this self-paces to the arrival rate
      // (you can't reveal text that hasn't streamed yet) while keeping a small trailing buffer.
      const frac = doneRef.current ? DONE_CATCHUP : CATCHUP;
      const step = Math.max(MIN_STEP, Math.ceil(gap * frac));
      shownRef.current = Math.min(target.length, shownRef.current + step);
      onTextRef.current(target.slice(0, shownRef.current));
    }
    if (doneRef.current && shownRef.current >= targetRef.current.length) {
      onTextRef.current(targetRef.current); // emit the exact final text, then stop
      rafRef.current = null;
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const ensureRunning = useCallback(() => {
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const push = useCallback(
    (target: string) => {
      targetRef.current = target;
      ensureRunning();
    },
    [ensureRunning],
  );

  const finish = useCallback(
    (finalText: string) => {
      targetRef.current = finalText;
      doneRef.current = true;
      ensureRunning();
    },
    [ensureRunning],
  );

  const reset = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    targetRef.current = '';
    shownRef.current = 0;
    doneRef.current = false;
    // Clear the display so the previous turn's text can't flash before the new reveal begins.
    onTextRef.current('');
  }, []);

  // Cancel any pending frame on unmount.
  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  return { push, finish, reset };
}
