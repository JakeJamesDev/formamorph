import { useCallback, useEffect, useRef } from 'react';
import { getRevealTiming, setRevealTiming } from './revealTimingStore';
import {
  flooredTiming, pacedStagger, FADE_SPREAD, DEFAULT_STAGGER, DEFAULT_DURATION,
  ARRIVAL_MIN_GAP_MS, ARRIVAL_EMA_ALPHA,
} from './narrationRevealConfig';

const countWords = (text: string): number => {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
};

/**
 * Paced sentence reveal (the Fade-in Narration path). Feed it cumulative completed-sentence prefixes
 * with `push` as narration streams; it releases them into `onText` one at a time, each after the
 * previous one's rhythm span — so consecutive sentences (and paragraphs) continue one seamless cascade.
 *
 * Pacing is measured, not estimated: it times the wall-clock gap between sentence arrivals and reveals
 * at that rate (`pacedStagger`), holding a small backlog buffer so it neither runs dry (stutter) nor
 * lags far behind (trail). It writes the resulting cadence to the timing store each release so the
 * renderer's word-fade matches. `minStagger`/`minDuration` are the user's readability floors. The
 * measured rate carries across turns (`reset` keeps it), so only the first turn pays the slow-start ramp.
 *
 * `finish` queues the final text (including the held last sentence), `reset` clears everything, and
 * `drained` resolves once the whole queue has played out, so the caller can hold the turn "busy" until
 * the reveal completes rather than dumping the backlog when the request ends.
 */
export function useSentenceReveal(onText: (text: string) => void, minStagger = 0, minDuration = 0) {
  const queueRef = useRef<string[]>([]);
  const shownRef = useRef('');
  const busyRef = useRef(false);
  const finishedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drainWaitersRef = useRef<Array<() => void>>([]);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  const minStaggerRef = useRef(minStagger);
  minStaggerRef.current = minStagger;
  const minDurationRef = useRef(minDuration);
  minDurationRef.current = minDuration;

  // Measured arrival cadence: ms per word, smoothed across real (non-burst) arrival gaps.
  const msPerWordRef = useRef(DEFAULT_STAGGER);
  const lastArrivalAtRef = useRef<number | null>(null);
  const lastArrivalWordsRef = useRef(0);

  const settleDrain = useCallback(() => {
    if (finishedRef.current && !busyRef.current && queueRef.current.length === 0) {
      const waiters = drainWaitersRef.current;
      drainWaitersRef.current = [];
      waiters.forEach((resolve) => resolve());
    }
  }, []);

  const pump = useCallback(() => {
    if (busyRef.current) return;
    const next = queueRef.current[0];
    if (next === undefined) {
      settleDrain();
      return;
    }
    // Set the cadence from the measured arrival rate and how much has piled up behind this release,
    // then write it to the store so the renderer's word fade matches. Backlog = all arrived-but-unshown
    // words (the deepest queued prefix minus what's shown), measured before we shift this one off.
    const deepest = queueRef.current[queueRef.current.length - 1];
    const backlogWords = countWords(deepest) - countWords(shownRef.current);
    const stagger = pacedStagger(msPerWordRef.current, backlogWords, finishedRef.current);
    setRevealTiming(flooredTiming({ stagger, duration: stagger * FADE_SPREAD }, minStaggerRef.current, minDurationRef.current));

    queueRef.current.shift();
    const addedWords = countWords(next) - countWords(shownRef.current);
    shownRef.current = next;
    onTextRef.current(next);
    busyRef.current = true;
    // Wait this sentence's rhythm span (its words × the cadence just set) before the next.
    timerRef.current = setTimeout(() => {
      busyRef.current = false;
      pump();
    }, addedWords * getRevealTiming().stagger);
  }, [settleDrain]);

  // Cumulative prefixes only grow, so a longer target is a genuinely new sentence to reveal. `measure`
  // updates the arrival-rate estimate from the gap since the previous arrival (skipped for the final
  // flush, and for arrivals closer than the burst threshold, which would read as infinitely fast).
  const enqueue = useCallback((target: string, measure: boolean) => {
    const last = queueRef.current.length
      ? queueRef.current[queueRef.current.length - 1]
      : shownRef.current;
    if (target.length <= last.length) return;
    queueRef.current.push(target);
    if (!measure) return;
    const now = Date.now();
    const words = countWords(target);
    if (lastArrivalAtRef.current !== null) {
      const dt = now - lastArrivalAtRef.current;
      const dw = words - lastArrivalWordsRef.current;
      if (dt >= ARRIVAL_MIN_GAP_MS && dw > 0) {
        const sample = dt / dw; // ms per word, observed
        msPerWordRef.current += ARRIVAL_EMA_ALPHA * (sample - msPerWordRef.current);
      }
    }
    lastArrivalAtRef.current = now;
    lastArrivalWordsRef.current = words;
  }, []);

  const push = useCallback(
    (cumulativePrefix: string) => {
      enqueue(cumulativePrefix, true);
      pump();
    },
    [enqueue, pump],
  );

  const finish = useCallback(
    (finalText: string) => {
      enqueue(finalText, false); // the end flush isn't a rate sample
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
    // Deliberately NOT reset: msPerWordRef carries the last turn's converged arrival rate into this one.
    // The model's speed is consistent turn to turn, so this is a far better seed than the fixed default —
    // it skips the slow-start ramp (and its visible catch-up) on every turn after the first. Only the
    // per-turn arrival tracking below is cleared, so the first arrival of the new turn measures no gap.
    lastArrivalAtRef.current = null;
    lastArrivalWordsRef.current = 0;
    setRevealTiming(flooredTiming({ stagger: DEFAULT_STAGGER, duration: DEFAULT_DURATION }, minStaggerRef.current, minDurationRef.current));
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
