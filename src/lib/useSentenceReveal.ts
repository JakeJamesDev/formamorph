import { useCallback, useEffect, useRef } from 'react';
import { getRevealTiming } from './revealTimingStore';

const countWords = (text: string): number => {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
};

/**
 * Paced sentence reveal (the Fade-in Narration path). Feed it cumulative completed-sentence prefixes
 * with `push` as narration streams; it releases them into `onText` one at a time, waiting for each
 * sentence's fade to finish before the next — so Streamdown never animates one over another. `finish`
 * queues the final text (including the held last sentence), `reset` clears everything, and `drained`
 * resolves once the whole queue has played out, so the caller can hold the turn "busy" until the
 * reveal completes rather than dumping the backlog when the request ends.
 */
export function useSentenceReveal(onText: (text: string) => void) {
  const queueRef = useRef<string[]>([]);
  const shownRef = useRef('');
  const busyRef = useRef(false);
  const finishedRef = useRef(false);
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

  const pump = useCallback(() => {
    if (busyRef.current) return;
    const next = queueRef.current.shift();
    if (next === undefined) {
      settleDrain();
      return;
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
      pump();
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
