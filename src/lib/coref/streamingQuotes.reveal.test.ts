// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSentenceReveal } from '@/lib/useSentenceReveal';
import { getRevealTiming } from '@/lib/revealTimingStore';
import { completeSentenceCount, completeSentencePrefix } from '@/lib/aiRequest/narrationStream';
import { REVEAL_TEST_PROFILES, type RevealArrivalEvent } from '@/lib/revealTestScripts';
import { createStreamingQuoteReader, type ReadQuotes } from './streamingQuotes';
import { quoteSpans, readPassageMentions, type MentionCast } from './mentionReading';
import { PROBE_PASSAGE } from './probePassage';

const CAST: MentionCast = [
  { id: 'wren', name: 'Wren', kind: 'unique' },
  { id: 'keeper', name: 'Keeper', aliases: ['the old keeper', 'old man'], kind: 'unique' },
];

const countWords = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

/** The attribution rules on the passage so far, after a fake run time. */
const fakeRead = (runMs: number): ReadQuotes => (passage) => new Promise((resolve) => {
  setTimeout(() => resolve(readPassageMentions(passage, [], CAST).reading.quotes), runMs);
});

const CHARS_PER_TOKEN = 3.9;

/** A stream in eight-char steps, as the reveal scripts step: each step runs at its tokens/s until its share of the text. */
const changingStream = (steps: [until: number, tokensPerSecond: number][]) => (length: number): RevealArrivalEvent[] => {
  const events: RevealArrivalEvent[] = [];
  let atMs = 0;
  for (let c = 8; c < length + 8; c += 8) {
    const chars = Math.min(c, length);
    const step = steps.find(([until]) => chars <= until * length) ?? steps[steps.length - 1];
    atMs += ((chars - (events.at(-1)?.chars ?? 0)) / (step[1] * CHARS_PER_TOKEN)) * 1000;
    events.push({ atMs: Math.round(atMs), chars });
  }
  return events;
};

/** A steady stream at `tokensPerSecond`. */
const tokenStream = (tokensPerSecond: number) => changingStream([[1, tokensPerSecond]]);

interface Run {
  /** Each word's reveal start, ms from the stream's start. */
  wordAt: number[];
  /** The pace of each release, ms per word. */
  paces: number[];
  /** Quotes that showed before their color was back. */
  uncolored: number;
}

// True while the test itself reads the gate, so a spy can tell its calls from the pacer's.
let checking = false;

/** One turn through the real pacer, fed as the preview feeds it: the reader first, then the pacer. */
async function playTurn(
  reveal: ReturnType<typeof useSentenceReveal>, released: { text: string; at: number }[],
  reader: ReturnType<typeof createStreamingQuoteReader> | null, read: ReadQuotes | null,
  text: string, schedule: RevealArrivalEvent[],
): Promise<Run> {
  released.length = 0;
  act(() => {
    if (reader) {
      reader.begin(read);
      reveal.setGate(read ? reader.gate : null);
    }
    reveal.reset();
    reveal.push('', 0);
  });
  const t0 = Date.now();
  const paces: number[] = [];
  const wordAt: number[] = [];
  let uncolored = 0;
  let shownWords = 0;
  // Records each release as the pacer makes it.
  const onRelease = (shown: string) => {
    if (!shown) return;
    const pace = getRevealTiming().stagger;
    paces.push(pace);
    const now = Date.now() - t0;
    const words = countWords(shown);
    for (let i = shownWords; i < words; i++) wordAt.push(now + (i - shownWords) * pace);
    shownWords = words;
    if (reader && read) {
      checking = true;
      const back = new Set(reader.gate.quotes(Date.now()).filter((q) => q.eta === null).map((q) => q.start));
      checking = false;
      uncolored += quoteSpans(shown).filter((q) => !back.has(q.start)).length;
    }
  };
  let seen = 0;
  const drain = () => {
    while (seen < released.length) onRelease(released[seen++].text);
  };
  let at = 0;
  for (const event of schedule) {
    await act(async () => { await vi.advanceTimersByTimeAsync(event.atMs - at); });
    at = event.atMs;
    drain();
    const slice = text.slice(0, event.chars);
    act(() => {
      reader?.update(slice, false);
      reveal.push(completeSentencePrefix(slice), completeSentenceCount(slice));
    });
    drain();
  }
  let done = false;
  act(() => {
    reader?.update(text, true);
    reveal.finish(text);
    void reveal.drained().then(() => { done = true; });
  });
  for (let i = 0; i < 2000 && !done; i++) {
    await act(async () => { await vi.advanceTimersByTimeAsync(16); });
    drain();
  }
  drain();
  expect(done).toBe(true);
  return { wordAt, paces, uncolored };
}

function setup() {
  const released: { text: string; at: number }[] = [];
  const { result } = renderHook(() => useSentenceReveal((text) => released.push({ text, at: Date.now() })));
  return { reveal: () => result.current, released };
}

/** A warm-up turn, as the second turn of a session, then the measured one, with the fallbacks of each. */
async function measure(read: ReadQuotes | null, schedule: (length: number) => RevealArrivalEvent[], text = PROBE_PASSAGE) {
  const { reveal, released } = setup();
  const reader = createStreamingQuoteReader();
  const fallBack = vi.spyOn(reader.gate, 'fallBack');
  await playTurn(reveal(), released, reader, read, text, schedule(text.length));
  const warmUpFallBacks = fallBack.mock.calls.length;
  fallBack.mockClear();
  const run = await playTurn(reveal(), released, reader, read, text, schedule(text.length));
  return { ...run, warmUpFallBacks, fallBacks: fallBack.mock.calls.length };
}

// Twelve lines of two speakers, a quote on every line.
const DIALOGUE = Array.from({ length: 12 }, (_, i) => (i % 2
  ? '"Then we wait here until the tide turns," Wren said.'
  : '"The boat leaves at dawn," the old keeper said.')).join('\n\n');
const PASSAGES = [['probe', PROBE_PASSAGE], ['12-line dialogue', DIALOGUE]] as const;

const maxGap = (times: number[]) => Math.max(...times.slice(1).map((t, i) => t - times[i]));
const report = (label: string, run: Run) =>
  `${label}: pace ${Math.round(Math.min(...run.paces))}–${Math.round(Math.max(...run.paces))} ms/word, `
  + `${(run.wordAt.at(-1)! / 1000).toFixed(1)} s, longest word gap ${Math.round(maxGap(run.wordAt))} ms`;

describe('streaming quote colors through the paced reveal (Q72)', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] }));
  afterEach(() => vi.useRealTimers());

  for (const profile of ['steady', 'burst'] as const) {
    // GPU runs take 17–119 ms; on these scripts a 1.25 s run stays gated too.
    for (const runMs of [17, 60, 119, 1250]) {
      it(`shows no quote before its color on the ${profile} script with a ${runMs} ms run`, async () => {
        const run = await measure(fakeRead(runMs), REVEAL_TEST_PROFILES[profile].schedule);
        expect([run.warmUpFallBacks, run.fallBacks]).toEqual([0, 0]);
        expect(run.wordAt).toHaveLength(countWords(PROBE_PASSAGE));
        expect(run.uncolored).toBe(0);
      });
    }
  }

  // No lead-in to slow over: only the gate holds the first quote until its color is back.
  const OPENS_ON_A_QUOTE = `"You're late," the old keeper said. ${PROBE_PASSAGE}`;
  for (const profile of ['steady', 'burst'] as const) {
    it(`holds a turn that opens on a quote until its color is back (${profile})`, async () => {
      const run = await measure(fakeRead(1250), REVEAL_TEST_PROFILES[profile].schedule, OPENS_ON_A_QUOTE);
      expect(run.fallBacks).toBe(0);
      expect(run.uncolored).toBe(0);
      expect(run.wordAt[0]).toBeGreaterThanOrEqual(1250);
    });
  }

  for (const [name, text] of PASSAGES) {
    it(`keeps streaming colors with every word under 150 ms, 1.25 s run at 50 tokens/s (${name})`, async () => {
      const smooth = await measure(fakeRead(1250), tokenStream(50), text);
      const today = await measure(null, tokenStream(50), text);
      console.info(`${report('smooth', smooth)}\n${report('today', today)}`);
      expect(smooth.fallBacks).toBe(0);
      expect(smooth.uncolored).toBe(0);
      expect(maxGap(smooth.wordAt)).toBeLessThanOrEqual(150);
    });

    it(`falls back to today's pace with a 1.25 s run at 100 tokens/s (${name})`, async () => {
      const fast = await measure(fakeRead(1250), tokenStream(100), text);
      const today = await measure(null, tokenStream(100), text);
      console.info(`${report('fallback', fast)}\n${report('today', today)}`);
      // The session's first turn falls back too, once its first run returns.
      expect([fast.warmUpFallBacks, fast.fallBacks]).toEqual([1, 1]);
      expect(Math.abs(maxGap(fast.wordAt) - maxGap(today.wordAt))).toBeLessThanOrEqual(maxGap(today.wordAt) * 0.1);
      expect(Math.abs(fast.wordAt.at(-1)! - today.wordAt.at(-1)!)).toBeLessThanOrEqual(today.wordAt.at(-1)! * 0.1);
    });

    it(`never falls back with a 60 ms run (${name})`, async () => {
      for (const tokensPerSecond of [25, 50, 100]) {
        const run = await measure(fakeRead(60), tokenStream(tokensPerSecond), text);
        expect([run.warmUpFallBacks, run.fallBacks, run.uncolored]).toEqual([0, 0, 0]);
      }
    });
  }

  it('keeps the colors read before a mid-turn fallback and never gates again', async () => {
    const { reveal, released } = setup();
    const reader = createStreamingQuoteReader();
    let reads = 0;
    // Names every quote it reads, so a read quote and a dropped one differ.
    const read: ReadQuotes = (passage) => {
      reads++;
      return new Promise((resolve) => setTimeout(() => resolve(quoteSpans(passage).map(({ start, end }) => ({ start, end, speaker: `s${start}` }))), 1250));
    };
    const slow = tokenStream(25);
    await playTurn(reveal(), released, reader, read, PROBE_PASSAGE, slow(PROBE_PASSAGE.length));
    // Slow, then a burst the model cannot keep up with, then slow again.
    let before: { start: number; speaker: string | null }[] = [];
    let readsAtFallBack = 0;
    let gateChecks = 0;
    let gateChecksAtFallBack = -1;
    const quotes = reader.gate.quotes;
    vi.spyOn(reader.gate, 'quotes').mockImplementation((now) => {
      if (!checking) gateChecks++;
      return quotes(now);
    });
    const fallBack = reader.gate.fallBack;
    const fellBack = vi.spyOn(reader.gate, 'fallBack').mockImplementation(() => {
      before = reader.live().quotes.map(({ start, speaker }) => ({ start, speaker }));
      readsAtFallBack = reads;
      gateChecksAtFallBack = gateChecks;
      fallBack();
    });
    const schedule = changingStream([[0.55, 25], [0.8, 200], [1, 25]]);
    await playTurn(reveal(), released, reader, read, PROBE_PASSAGE, schedule(PROBE_PASSAGE.length));
    expect(fellBack).toHaveBeenCalledOnce();
    expect(before.some((q) => q.speaker !== null)).toBe(true);
    const after = reader.live().quotes;
    expect(after.length).toBeGreaterThan(before.length);
    // Read quotes keep their colors; the rest wait for the full-turn reading.
    for (const q of after) expect(q.speaker).toBe(before.find((b) => b.start === q.start)?.speaker ?? null);
    expect(reads).toBe(readsAtFallBack);
    expect(gateChecks).toBe(gateChecksAtFallBack);
  });

  it('costs at most 5% of the reveal time with a 60 ms run', async () => {
    const smooth = await measure(fakeRead(60), tokenStream(50));
    const today = await measure(null, tokenStream(50));
    console.info(`${report('smooth', smooth)}\n${report('today', today)}`);
    expect(smooth.wordAt.at(-1)!).toBeLessThanOrEqual(today.wordAt.at(-1)! * 1.05);
  });

  it('shows a quote uncolored after the hold cap when its run never ends', async () => {
    const never: ReadQuotes = () => new Promise(() => {});
    const run = await measure(never, REVEAL_TEST_PROFILES.steady.schedule);
    expect(run.wordAt).toHaveLength(countWords(PROBE_PASSAGE));
    expect(run.uncolored).toBeGreaterThan(0);
  });
});
