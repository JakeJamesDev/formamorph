/**
 * Streaming quote reading (Q72): reads each quote's speaker on the passage so far while narration streams, so
 * the paced reveal can show a quote in its speaker's color the first time it appears. The full-turn reading
 * at narration end stays the one saved.
 */
import { ARRIVAL_EMA_ALPHA, DEFAULT_QUOTE_RUN_MS } from '@/lib/narrationRevealConfig';
import type { QuoteGate, GateQuote } from '@/lib/useSentenceReveal';
import type { SpokenQuote } from '@/lib/quoteSegments';
import { quoteSpans, type QuoteSpeaker } from './mentionReading';

/** Reads the quotes of a passage; null when no model can read. */
export type ReadQuotes = (passage: string) => Promise<readonly QuoteSpeaker[] | null>;

/** The turn's quotes read so far, over the narration that has arrived. The reader updates it in place, so a
 *  renderer that holds it reads the newest speakers on its next render. */
export interface LiveQuotes {
  text: string;
  quotes: SpokenQuote[];
  /** Called when a run finishes, after `quotes` holds its speakers. */
  subscribe?(listener: () => void): () => void;
}

const HOLD_RE = /[.!?](?=\s)|["“]|\n\s*\n/;
const CLOSES_RE = /["”]$/;

/**
 * Where a quote ending at `end` can be read: the end of the tag sentence after it, the next quote, or the
 * paragraph end, whichever comes first. Null while none has arrived; the text end once the stream finished.
 */
export function holdPoint(text: string, end: number, finished: boolean): number | null {
  const hit = HOLD_RE.exec(text.slice(end));
  if (!hit) return finished ? text.length : null;
  return end + hit.index + (/^[.!?]/.test(hit[0]) ? 1 : 0);
}

interface TrackedQuote {
  start: number;
  end: number;
  /** Null until the quote's hold point has arrived. */
  hold: number | null;
  /** Its closing mark has arrived, so its span is final. */
  closed: boolean;
  /** Undefined until a run reads it. */
  speaker: string | null | undefined;
}

export interface StreamingQuoteReader {
  /** Start a turn. With no `read`, the gate stays open and no quote is read early. */
  begin(read: ReadQuotes | null): void;
  /** The narration that has arrived; `finished` once the stream ended. */
  update(text: string, finished: boolean): void;
  /** Drop the turn: later runs land nowhere and the gate opens. */
  cancel(): void;
  /** This turn's quotes as read so far. A new object per turn. */
  live(): LiveQuotes;
  /** What the paced reveal holds on. */
  gate: QuoteGate;
}

/** One reader per view. Runs go one at a time; each covers every quote whose hold point has arrived. The run
 *  time average carries across turns. */
export function createStreamingQuoteReader(now: () => number = Date.now): StreamingQuoteReader {
  let runMs = DEFAULT_QUOTE_RUN_MS;
  let sampled = false;
  let turn = 0;
  let read: ReadQuotes | null = null;
  let text = '';
  let finished = false;
  let tracked: TrackedQuote[] = [];
  let running: { startedAt: number; cut: number } | null = null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  };
  const emptyLive = (): LiveQuotes => ({ text: '', quotes: [], subscribe });
  let live = emptyLive();

  // A closed quote is listed before its run ends (no speaker yet), so its span carries the key a late color
  // finds it by.
  const publish = () => {
    live.text = text;
    live.quotes = tracked.flatMap((q) => (q.speaker === undefined && !q.closed
      ? []
      : [{ start: q.start, end: q.end, speaker: q.speaker ?? null }]));
  };

  const scan = () => {
    const before = new Map(tracked.map((q) => [q.start, q]));
    tracked = quoteSpans(text).map(({ start, end, paragraphEnd }) => {
      const prev = before.get(start);
      if (prev && prev.end === end && prev.hold !== null) return prev;
      const closed = finished || paragraphEnd < text.length || CLOSES_RE.test(text.slice(start + 1, end));
      return { start, end, closed, hold: closed ? holdPoint(text, end, finished) : null, speaker: read ? undefined : null };
    });
  };

  const sample = (ms: number) => {
    // The first run of the session beats the default outright; later ones smooth into it.
    runMs = sampled ? runMs + ARRIVAL_EMA_ALPHA * (ms - runMs) : ms;
    sampled = true;
  };

  const settle = (cut: number, speakers: readonly QuoteSpeaker[] | null) => {
    for (const q of tracked) {
      if (q.speaker !== undefined || q.hold === null || q.hold > cut) continue;
      q.speaker = speakers?.find((s) => s.start === q.start)?.speaker ?? null;
    }
  };

  const pump = () => {
    if (!read || running) return;
    const due = tracked.filter((q) => q.speaker === undefined && q.hold !== null);
    if (!due.length) return;
    const cut = Math.max(...due.map((q) => q.hold!));
    const id = turn;
    const startedAt = now();
    running = { startedAt, cut };
    read(text.slice(0, cut)).then(
      (speakers) => {
        if (id !== turn) return;
        sample(now() - startedAt);
        if (speakers === null) {
          // The model went away: every quote shows as it is, and colors come with the full-turn reading.
          read = null;
          for (const q of tracked) if (q.speaker === undefined) q.speaker = null;
        } else settle(cut, speakers);
      },
      (error: unknown) => {
        if (id !== turn) return;
        console.warn('Character Mentions could not read a quote early', error);
        settle(cut, null);
      },
    ).finally(() => {
      if (id !== turn) return;
      running = null;
      publish();
      notify();
      pump();
    });
  };

  const gate: QuoteGate = {
    quotes(at: number): GateQuote[] {
      const runEnd = running ? Math.max(at, running.startedAt + runMs) : at;
      const queued = tracked.some((q) => q.speaker === undefined && q.hold !== null && !(running && q.hold <= running.cut));
      return tracked.map((q) => {
        if (q.speaker !== undefined) return { start: q.start, eta: null };
        if (running && q.hold !== null && q.hold <= running.cut) return { start: q.start, eta: runEnd };
        if (q.hold !== null) return { start: q.start, eta: runEnd + runMs };
        return { start: q.start, eta: runEnd + runMs * (queued ? 2 : 1) };
      });
    },
    runMs: () => runMs,
    subscribe,
  };

  return {
    begin(next) {
      turn++;
      read = next;
      text = '';
      finished = false;
      tracked = [];
      running = null;
      live = emptyLive();
    },
    update(next, done) {
      if (next === text && done === finished) return;
      text = next;
      finished = done;
      scan();
      publish();
      pump();
    },
    cancel() {
      turn++;
      read = null;
      running = null;
      for (const q of tracked) if (q.speaker === undefined) q.speaker = null;
      notify();
    },
    live: () => live,
    gate,
  };
}
