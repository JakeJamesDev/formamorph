import { useCallback, useEffect, useRef } from 'react';
import { getRevealTiming, getRevealPaceScale, setRevealPaceScale } from './revealTimingStore';
import { PACE_FEEDBACK_UP, PACE_FEEDBACK_DOWN, PACE_SCALE_MAX } from './narrationRevealConfig';

const countWords = (text: string): number => {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
};

/**
 * Paced sentence reveal (the Fade-in Narration path). Feed it cumulative completed-sentence prefixes
 * with `push` as narration streams; it releases them into `onText` one at a time, each after the
 * previous one's rhythm span — so consecutive sentences continue one seamless cascade. A release that
 * opens a new paragraph additionally waits out the previous fade's tail, so a paragraph fully lands
 * before the next starts below it. `finish` queues the final text (including the held last sentence),
 * `reset` clears everything, and `drained` resolves once the whole queue has played out, so the caller
 * can hold the turn "busy" until the reveal completes rather than dumping the backlog when the
 * request ends.
 */
export function useSentenceReveal(onText: (text: string) => void) {
  const queueRef = useRef<string[]>([]);
  const shownRef = useRef('');
  const busyRef = useRef(false);
  const finishedRef = useRef(false);
  const tailWaitedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drainWaitersRef = useRef<Array<() => void>>([]);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const settleDrain = useCallback(() => {
    if (finishedRef.current && !busyRef.current && queueRef.current.length === 0) {
      const waiters = drainWaitersRef.current;
      drainWaitersRef.current = [];
      waiters.forEach((resolve) => resolve());
    }
  }, []);

  const pump = useCallback((fromTimer = false) => {
    if (busyRef.current) return;
    const next = queueRef.current[0];
    if (next === undefined) {
      // Ran dry the instant a release's rhythm ended, mid-stream: the pace is outrunning arrival —
      // stretch it before the next release. Only the timer path signals a real starve; push-driven
      // pumps with nothing queued are just tokens arriving mid-sentence.
      if (fromTimer && !finishedRef.current) {
        setRevealPaceScale(Math.min(getRevealPaceScale() * PACE_FEEDBACK_UP, PACE_SCALE_MAX));
      }
      settleDrain();
      return;
    }
    // A release that opens a new paragraph first waits out the previous sentence's fade tail, so the
    // old paragraph fully lands before text starts appearing below it. (Within a paragraph the tail
    // overlap IS the seamless cascade; across a blank line it reads as two blocks animating at once.)
    // The rhythm wait covers only when each word STARTS fading; the tail is the fade duration itself.
    const startsParagraph =
      shownRef.current !== '' &&
      ((/^\s*/.exec(next.slice(shownRef.current.length))?.[0] ?? '').split('\n').length - 1) >= 2;
    if (startsParagraph && !tailWaitedRef.current) {
      tailWaitedRef.current = true;
      busyRef.current = true;
      timerRef.current = setTimeout(() => {
        busyRef.current = false;
        pump();
      }, getRevealTiming().duration);
      return;
    }
    tailWaitedRef.current = false;
    queueRef.current.shift();
    // Two or more releases already waiting behind this one: we're falling behind arrival — tighten
    // the pace back toward the base (never past it; the base carries the user's minimum floors).
    if (queueRef.current.length >= 2) {
      setRevealPaceScale(Math.max(getRevealPaceScale() * PACE_FEEDBACK_DOWN, 1));
    }
    const addedWords = countWords(next) - countWords(shownRef.current);
    shownRef.current = next;
    onTextRef.current(next);
    busyRef.current = true;
    // Wait exactly the sentence's rhythm span (its words × the current cadence) before the next, so
    // its cascade continues seamlessly at the model's smoothed pace. Read at release time to match the
    // fade the renderer applies to this same sentence.
    timerRef.current = setTimeout(() => {
      busyRef.current = false;
      pump(true);
    }, addedWords * getRevealTiming().stagger);
  }, [settleDrain]);

  // Cumulative prefixes only grow, so a longer target is a genuinely new sentence to reveal.
  const enqueue = useCallback((target: string) => {
    const last = queueRef.current.length
      ? queueRef.current[queueRef.current.length - 1]
      : shownRef.current;
    if (target.length > last.length) queueRef.current.push(target);
  }, []);

  const push = useCallback(
    (cumulativePrefix: string) => {
      enqueue(cumulativePrefix);
      pump();
    },
    [enqueue, pump],
  );

  const finish = useCallback(
    (finalText: string) => {
      enqueue(finalText);
      finishedRef.current = true;
      // Arrival is over, so feedback's job is done — the caller just pinned the base timing to the
      // whole-turn true rate, and the remaining backlog should drain at that pace, not a stretched one.
      setRevealPaceScale(1);
      pump();
    },
    [enqueue, pump],
  );

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    queueRef.current = [];
    shownRef.current = '';
    busyRef.current = false;
    finishedRef.current = false;
    tailWaitedRef.current = false;
    setRevealPaceScale(1);
    onTextRef.current('');
    // Don't leave a caller awaiting a reveal we just cleared.
    const waiters = drainWaitersRef.current;
    drainWaitersRef.current = [];
    waiters.forEach((resolve) => resolve());
  }, []);

  const drained = useCallback(
    () =>
      new Promise<void>((resolve) => {
        if (finishedRef.current && !busyRef.current && queueRef.current.length === 0) resolve();
        else drainWaitersRef.current.push(resolve);
      }),
    [],
  );

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return { push, finish, reset, drained };
}
