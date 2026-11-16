import { useCallback, useEffect, useRef } from 'react';
import { getRevealReleased, getRevealTiming, setRevealReleased, setRevealTiming } from './revealTimingStore';
import {
  flooredTiming, pacedStagger, FADE_SPREAD, DEFAULT_STAGGER, DEFAULT_DURATION,
  ARRIVAL_MIN_GAP_MS, ARRIVAL_EMA_ALPHA, TARGET_BUFFER_WORDS, DRAIN_CORRECTION_MIN,
  STAGGER_MAX, PACE_EASE_MS, QUOTE_HOLD_MAX_MS,
} from './narrationRevealConfig';

const countWords = (text: string): number => {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
};

/** One quote in the arrived narration: where it opens, and when its color is due (Date.now ms); null once back. */
export interface GateQuote {
  start: number;
  eta: number | null;
}

/** The turn's quote colors as the reveal sees them (Q72). */
export interface QuoteGate {
  /** Every quote in the arrived narration, in order. */
  quotes(now: number): readonly GateQuote[];
  /** What one model run takes on this device, in ms. */
  runMs(): number;
  /** Called when a color comes back. */
  subscribe(listener: () => void): () => void;
}

/** A cumulative prefix waiting to show, with the count of sentences it holds. */
interface Release {
  text: string;
  sentences: number;
}

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
 * Each push names how many sentences its prefix holds; the pacer publishes the count it has released to the
 * store, and the final text counts as every sentence.
 *
 * With a quote gate (`setGate`), it never releases the sentence that opens a quote whose color is not back,
 * and slows ahead of it: a buffer that also covers one model run, a pace planned for every queued quote, and eased pace changes.
 *
 * `finish` queues the final text (including the held last sentence), `reset` clears everything, and
 * `drained` resolves once the whole queue has played out, so the caller can hold the turn "busy" until
 * the reveal completes rather than dumping the backlog when the request ends.
 */
export function useSentenceReveal(onText: (text: string) => void, minStagger = 0, minDuration = 0) {
  const queueRef = useRef<Release[]>([]);
  const shownRef = useRef('');
  const busyRef = useRef(false);
  const finishedRef = useRef(false);
  // No reveal has started yet; `isDrained` reads that as drained.
  const startedRef = useRef(false);
  const skippingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drainWaitersRef = useRef<Array<() => void>>([]);
  // When the last released sentence's final word finishes fading in (Date.now ms).
  const visualEndRef = useRef(0);
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
  const sampledRef = useRef(false);

  // The quote gate, and the gated pace's easing state: the last pace and when it was set.
  const gateRef = useRef<{ gate: QuoteGate; unsubscribe: () => void } | null>(null);
  const easedRef = useRef<{ stagger: number; at: number } | null>(null);
  // The quote the reveal holds at, and when the hold began.
  const holdRef = useRef<{ start: number; since: number } | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A hold reached its cap this turn.
  const gaveUpRef = useRef(false);

  const clearHold = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
    holdRef.current = null;
  };

  const settleDrain = useCallback(() => {
    if (finishedRef.current && !busyRef.current && queueRef.current.length === 0) {
      // Drained means read: hold until the last words have faded in, not just been released.
      const tail = visualEndRef.current - Date.now();
      if (tail > 0) {
        busyRef.current = true;
        timerRef.current = setTimeout(() => {
          busyRef.current = false;
          settleDrain();
        }, tail);
        return;
      }
      const waiters = drainWaitersRef.current;
      drainWaitersRef.current = [];
      waiters.forEach((resolve) => resolve());
    }
  }, []);

  /** The gated pace for this release, or null to hold. `next` is the release about to show. */
  const gatedStagger = useCallback((gate: QuoteGate, next: Release, backlogWords: number, pump: () => void): number | null => {
    const now = Date.now();
    const shown = shownRef.current;
    const queue = queueRef.current;
    const arrived = queue[queue.length - 1].text;
    const quotes = gate.quotes(now);
    // The sentence that opens a quote whose color is not back waits for it.
    const blocking = quotes.find((q) => q.eta !== null && q.start >= shown.length && q.start < next.text.length);
    if (blocking) {
      const hold = holdRef.current?.start === blocking.start ? holdRef.current : { start: blocking.start, since: now };
      holdRef.current = hold;
      const left = hold.since + QUOTE_HOLD_MAX_MS - now;
      if (left > 0) {
        if (!holdTimerRef.current) holdTimerRef.current = setTimeout(() => { holdTimerRef.current = null; pump(); }, left);
        return null;
      }
      // A run that never ends must not stall the turn: past the cap, the rest of the turn reveals ungated.
      gaveUpRef.current = true;
      clearHold();
      return pacedStagger(msPerWordRef.current, backlogWords, finishedRef.current);
    }
    clearHold();

    const runMs = gate.runMs();
    const msPerWord = msPerWordRef.current;
    const finished = finishedRef.current;
    let stagger = pacedStagger(msPerWord, backlogWords, finished, TARGET_BUFFER_WORDS + runMs / msPerWord, DRAIN_CORRECTION_MIN);
    // Plan for every queued quote that has arrived: reach the sentence that opens it no sooner than its color.
    const shownWords = countWords(shown);
    for (const q of quotes) {
      if (q.eta === null || q.start < shown.length || q.start >= arrived.length) continue;
      const opener = queue.findLast((r) => r.text.length <= q.start);
      const ahead = countWords(opener?.text ?? shown) - shownWords;
      if (ahead > 0) stagger = Math.max(stagger, Math.min(STAGGER_MAX, (q.eta - now) / ahead));
    }
    const eased = easedRef.current;
    if (eased) stagger = eased.stagger + (stagger - eased.stagger) * (1 - Math.exp(-(now - eased.at) / PACE_EASE_MS));
    easedRef.current = { stagger, at: now };
    return stagger;
  }, []);

  const pump = useCallback(() => {
    if (busyRef.current) return;
    const next = queueRef.current[0];
    if (next === undefined) {
      settleDrain();
      return;
    }
    if (skippingRef.current) {
      clearHold();
      const deepest = queueRef.current[queueRef.current.length - 1];
      queueRef.current = [];
      shownRef.current = deepest.text;
      visualEndRef.current = 0;
      setRevealReleased(deepest.sentences);
      onTextRef.current(deepest.text);
      settleDrain();
      return;
    }
    // Set the cadence from the measured arrival rate and how much has piled up behind this release,
    // then write it to the store so the renderer's word fade matches. Backlog = all arrived-but-unshown
    // words (the deepest queued prefix minus what's shown), measured before we shift this one off.
    const deepest = queueRef.current[queueRef.current.length - 1];
    const backlogWords = countWords(deepest.text) - countWords(shownRef.current);
    const gate = gaveUpRef.current ? undefined : gateRef.current?.gate;
    const stagger = gate
      ? gatedStagger(gate, next, backlogWords, pump)
      : pacedStagger(msPerWordRef.current, backlogWords, finishedRef.current);
    if (stagger === null) return;
    setRevealTiming(flooredTiming({ stagger, duration: stagger * FADE_SPREAD }, minStaggerRef.current, minDurationRef.current));

    queueRef.current.shift();
    const addedWords = countWords(next.text) - countWords(shownRef.current);
    shownRef.current = next.text;
    setRevealReleased(next.sentences);
    onTextRef.current(next.text);
    const timing = getRevealTiming();
    visualEndRef.current = Date.now() + addedWords * timing.stagger + timing.duration;
    busyRef.current = true;
    // Wait this sentence's rhythm span (its words × the cadence just set) before the next.
    timerRef.current = setTimeout(() => {
      busyRef.current = false;
      pump();
    }, addedWords * timing.stagger);
  }, [settleDrain, gatedStagger]);

  // Cumulative prefixes only grow, so a longer target is a genuinely new sentence to reveal. `measure`
  // updates the arrival-rate estimate from the gap since the previous arrival (skipped for the final
  // flush, and for arrivals closer than the burst threshold, which would read as infinitely fast).
  const enqueue = useCallback((target: string, sentences: number, measure: boolean) => {
    const last = queueRef.current.length
      ? queueRef.current[queueRef.current.length - 1].text
      : shownRef.current;
    if (target.length <= last.length) {
      // A sentence rewritten to nothing adds no text, yet it releases with the prefix before it.
      const tail = queueRef.current.at(-1);
      if (tail) tail.sentences = Math.max(tail.sentences, sentences);
      else setRevealReleased(Math.max(getRevealReleased(), sentences));
      return;
    }
    queueRef.current.push({ text: target, sentences });
    if (!measure) return;
    const now = Date.now();
    const words = countWords(target);
    if (lastArrivalAtRef.current !== null) {
      const dt = now - lastArrivalAtRef.current;
      const dw = words - lastArrivalWordsRef.current;
      if (dt >= ARRIVAL_MIN_GAP_MS && dw > 0) {
        const sample = dt / dw; // ms per word, observed
        // A turn's first real sample beats the carried rate outright; later ones smooth into it.
        msPerWordRef.current = sampledRef.current ? msPerWordRef.current + ARRIVAL_EMA_ALPHA * (sample - msPerWordRef.current) : sample;
        sampledRef.current = true;
      }
    }
    lastArrivalAtRef.current = now;
    lastArrivalWordsRef.current = words;
  }, []);

  const push = useCallback(
    (cumulativePrefix: string, sentences: number) => {
      // The first call marks the stream's start, so the first sentence's arrival is a rate sample too.
      if (lastArrivalAtRef.current === null && !cumulativePrefix && !shownRef.current && !queueRef.current.length) {
        lastArrivalAtRef.current = Date.now();
        lastArrivalWordsRef.current = 0;
      }
      enqueue(cumulativePrefix, sentences, true);
      pump();
    },
    [enqueue, pump],
  );

  const finish = useCallback(
    (finalText: string) => {
      enqueue(finalText, Number.POSITIVE_INFINITY, false); // the end flush isn't a rate sample
      finishedRef.current = true;
      pump();
    },
    [enqueue, pump],
  );

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    clearHold();
    queueRef.current = [];
    shownRef.current = '';
    busyRef.current = false;
    finishedRef.current = false;
    startedRef.current = true;
    skippingRef.current = false;
    visualEndRef.current = 0;
    easedRef.current = null;
    gaveUpRef.current = false;
    // Deliberately NOT reset: msPerWordRef carries the last turn's converged arrival rate into this one.
    // The model's speed is consistent turn to turn, so this is a far better seed than the fixed default —
    // it skips the slow-start ramp (and its visible catch-up) on every turn after the first. Only the
    // per-turn arrival tracking below is cleared, so the first arrival of the new turn measures no gap.
    lastArrivalAtRef.current = null;
    lastArrivalWordsRef.current = 0;
    sampledRef.current = false;
    setRevealTiming(flooredTiming({ stagger: DEFAULT_STAGGER, duration: DEFAULT_DURATION }, minStaggerRef.current, minDurationRef.current));
    setRevealReleased(0);
    onTextRef.current('');
    // Don't leave a caller awaiting a reveal we just cleared.
    const waiters = drainWaitersRef.current;
    drainWaitersRef.current = [];
    waiters.forEach((resolve) => resolve());
  }, []);

  // While on, drops the pacing: what has arrived shows now, and later sentences on arrival.
  const setSkipping = useCallback((on: boolean) => {
    if (skippingRef.current === on) return;
    skippingRef.current = on;
    if (!on) return;
    visualEndRef.current = 0;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    busyRef.current = false;
    pump();
  }, [pump]);

  // The quote gate for the turns that follow; null drops it. A held release re-checks when a color comes back.
  const setGate = useCallback((gate: QuoteGate | null) => {
    if (gateRef.current?.gate === gate) return;
    gateRef.current?.unsubscribe();
    clearHold();
    easedRef.current = null;
    gateRef.current = gate ? { gate, unsubscribe: gate.subscribe(() => pump()) } : null;
    pump();
  }, [pump]);

  const settled = useCallback(() => finishedRef.current && !busyRef.current && queueRef.current.length === 0, []);
  const isDrained = useCallback(() => !startedRef.current || settled(), [settled]);

  const drained = useCallback(
    () =>
      new Promise<void>((resolve) => {
        if (settled()) resolve();
        else drainWaitersRef.current.push(resolve);
      }),
    [settled],
  );

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    gateRef.current?.unsubscribe();
  }, []);

  return { push, finish, reset, drained, isDrained, setSkipping, setGate };
}
